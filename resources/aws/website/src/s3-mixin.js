import {resolve, relative} from 'path';
import {statSync, createReadStream} from 'fs';
import {pick, isEqual} from 'lodash';
import {task, formatString, formatPath, formatMessage} from '@resdir/console';
import {S3, getS3WebsiteDomainName} from '@resdir/aws-client';
import readDir from 'recursive-readdir';
import hasha from 'hasha';
import mime from 'mime-types';
import bytes from 'bytes';

// TODO: S'assurer qu'il y a une favicon en mode SPA

export default base =>
  class S3Mixin extends base {
    async configureS3Bucket({verbose, quiet, debug}) {
      const s3 = this.getS3Client();
      const bucketName = this.getS3BucketName();
      const region = this.getS3BucketRegion();

      await task(
        async progress => {
          let hasBeenCreated;
          const tags = await getS3BucketTags(s3, bucketName);
          if (tags === undefined) {
            // The bucket doesn't exist yet
            progress.setMessage('Creating S3 bucket...');
            progress.setOutro('S3 bucket created');
            const params = {Bucket: bucketName, ACL: 'public-read'};
            if (region !== 'us-east-1') {
              params.CreateBucketConfiguration = {LocationConstraint: region};
            }
            await s3.createBucket(params);
            await s3.putBucketTagging({
              Bucket: bucketName,
              Tagging: {TagSet: [this.constructor.MANAGED_BY_TAG]}
            });
            hasBeenCreated = true;
          }

          if (!hasBeenCreated && !tags.some(tag => isEqual(tag, this.constructor.MANAGED_BY_TAG))) {
            throw new Error(
              `Can't use a S3 bucket not originally created by ${formatString(
                this.constructor.RESOURCE_ID
              )} (bucketName: ${formatString(bucketName)})`
            );
          }

          if (!hasBeenCreated) {
            const result = await s3.getBucketLocation({Bucket: bucketName});
            const locationConstraint = result.LocationConstraint || 'us-east-1';
            if (locationConstraint !== region) {
              throw new Error(
                `Sorry, it is currently not possible to change the region of the S3 bucket associated to your website. Please remove the bucket (${formatString(
                  bucketName
                )}) manually or set the region to its initial value (${formatString(
                  locationConstraint
                )}).`
              );
            }
          }

          const websiteConfiguration = {IndexDocument: {Suffix: this.indexPage}};
          if (this.spa) {
            websiteConfiguration.ErrorDocument = {Key: this.indexPage};
          } else if (this.errorPage) {
            websiteConfiguration.ErrorDocument = {Key: this.errorPage};
          }

          let currentWebsiteConfiguration;
          if (!hasBeenCreated) {
            const result = await getS3BucketWebsiteConfiguration(s3, bucketName);
            currentWebsiteConfiguration = pick(result, ['IndexDocument', 'ErrorDocument']);
          }

          if (!isEqual(currentWebsiteConfiguration, websiteConfiguration)) {
            if (!hasBeenCreated) {
              progress.setMessage('Updating S3 bucket...');
              progress.setOutro('S3 bucket updated');
            }
            await s3.putBucketWebsite({
              Bucket: bucketName,
              WebsiteConfiguration: websiteConfiguration
            });
          }
        },
        {
          intro: `Checking S3 bucket...`,
          outro: `S3 bucket checked`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async synchronizeFiles({verbose, quiet, debug}) {
      const s3 = this.getS3Client();
      const bucketName = this.getS3BucketName();

      await task(
        async progress => {
          const contentDirectory = resolve(this.$getCurrentDirectory(), this.contentDirectory);
          const contentFiles = await readDir(contentDirectory, ['.*']);

          const existingFiles = await task(
            async () => {
              const result = await s3.listObjectsV2({Bucket: bucketName});

              if (result.IsTruncated) {
                throw new Error(
                  'Wow, you have a lot of files on S3! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if you really need to handle so many files.'
                );
              }

              return result.Contents.map(item => {
                let md5 = item.ETag;
                md5 = md5.slice(1);
                md5 = md5.slice(0, -1);
                return {path: item.Key, md5, size: item.Size};
              });
            },
            {
              intro: `Listing existing files on S3...`,
              outro: `Existing files on S3 listed`,
              verbose,
              quiet,
              debug
            }
          );

          let addedFiles = 0;
          let updatedFiles = 0;
          let removedFiles = 0;

          for (const contentFile of contentFiles) {
            const path = relative(contentDirectory, contentFile);
            const md5 = await hasha.fromFile(contentFile, {algorithm: 'md5'});
            const size = statSync(contentFile).size;

            let existingFile;
            const index = existingFiles.findIndex(file => file.path === path);
            if (index !== -1) {
              existingFile = existingFiles[index];
              existingFiles.splice(index, 1);
            }

            if (existingFile && existingFile.size === size && existingFile.md5 === md5) {
              continue; // File is identical in S3
            }

            await task(
              async () => {
                const contentMD5 = new Buffer(md5, 'hex').toString('base64');
                const mimeType = mime.lookup(path) || 'application/octet-stream';
                const stream = createReadStream(contentFile);
                await s3.putObject({
                  Bucket: bucketName,
                  Key: path,
                  ACL: 'public-read',
                  Body: stream,
                  ContentType: mimeType,
                  ContentMD5: contentMD5
                });
              },
              {
                intro: formatMessage(`Uploading ${formatPath(path)}...`, {
                  info: '(' + bytes(size) + ')'
                }),
                outro: `File uploaded`,
                verbose,
                quiet,
                debug
              }
            );

            if (!existingFile) {
              addedFiles++;
            } else {
              updatedFiles++;
            }
          }

          for (const file of existingFiles) {
            await task(
              async () => {
                await s3.deleteObject({Bucket: bucketName, Key: file.path});
                removedFiles++;
              },
              {
                intro: `Removing ${formatPath(file.path)}...`,
                outro: `File removed`,
                verbose,
                quiet,
                debug
              }
            );
          }

          let info = '';
          if (addedFiles) {
            info += addedFiles + ' file';
            if (addedFiles > 1) {
              info += 's';
            }
            info += ' added';
          }
          if (updatedFiles) {
            if (info) {
              info += ', ';
            }
            info += updatedFiles + ' file';
            if (updatedFiles > 1) {
              info += 's';
            }
            info += ' updated';
          }
          if (removedFiles) {
            if (info) {
              info += ', ';
            }
            info += removedFiles + ' file';
            if (removedFiles > 1) {
              info += 's';
            }
            info += ' removed';
          }
          if (!info) {
            info = 'no change';
          }

          progress.setOutro(formatMessage('Files synchronized', {info: '(' + info + ')'}));
        },
        {
          intro: `Synchronizing files...`,
          outro: `Files synchronized`,
          verbose,
          quiet,
          debug
        }
      );
    }

    getS3BucketName() {
      return this.domainName;
    }

    getS3BucketRegion() {
      return (this.aws.s3 && this.aws.s3.region) || this.aws.region;
    }

    getS3WebsiteDomainName() {
      return getS3WebsiteDomainName(this.getS3BucketName(), this.getS3BucketRegion());
    }

    getS3Client() {
      if (!this._s3Client) {
        this._s3Client = new S3(this.aws);
      }
      return this._s3Client;
    }
  };

async function getS3BucketWebsiteConfiguration(s3, bucketName) {
  try {
    return await s3.getBucketWebsite({Bucket: bucketName});
  } catch (err) {
    if (err.code === 'NoSuchWebsiteConfiguration') {
      return {};
    }
    throw err;
  }
}

async function getS3BucketTags(s3, bucketName) {
  // Returns undefined if the bucket doesn't exist
  try {
    const {TagSet} = await s3.getBucketTagging({Bucket: bucketName});
    return TagSet;
  } catch (err) {
    if (err.code === 'NoSuchTagSet') {
      return [];
    }
    if (err.code === 'NoSuchBucket') {
      return undefined;
    }
    if (err.code === 'AccessDenied') {
      throw new Error(`Access denied to S3 bucket (${formatString(bucketName)})`);
    }
    throw err;
  }
}
