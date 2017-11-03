import {resolve, relative} from 'path';
import {statSync, createReadStream} from 'fs';
import {pick, isEqual} from 'lodash';
import {task, formatString, formatCode, formatPath, formatMessage} from '@resdir/console';
import {S3, CloudFront} from '@resdir/aws-client';
import readDir from 'recursive-readdir';
import hasha from 'hasha';
import mime from 'mime-types';
import bytes from 'bytes';

const RESOURCE_ID = 'aws/website';
const MANAGED_BY_TAG = {Key: 'managed-by', Value: 'aws-website-resource-v1'};

export default base =>
  class extends base {
    async deploy(_args, {verbose, quiet, debug}) {
      if (!this.domainName) {
        throw new Error(`${formatCode('domainName')} property is missing`);
      }

      await this.configureS3Bucket({verbose, quiet, debug});
      await this.synchronizeFiles({verbose, quiet, debug});
      await this.configureCloudFrontDistribution({verbose, quiet, debug});
    }

    async configureS3Bucket({verbose, quiet, debug}) {
      const s3 = this.getS3Client();
      const bucketName = this.getS3BucketName();

      await task(
        async progress => {
          const hasBeenCreated = await ensureS3Buket(s3, bucketName);

          if (hasBeenCreated) {
            await s3.putBucketTagging({
              Bucket: bucketName,
              Tagging: {TagSet: [MANAGED_BY_TAG]}
            });
          } else {
            const tags = await getS3BucketTags(s3, bucketName);
            if (!tags.some(tag => isEqual(tag, MANAGED_BY_TAG))) {
              throw new Error(
                `Can't use a S3 bucket not originally created by ${formatString(
                  RESOURCE_ID
                )} (bucketName: ${formatString(bucketName)})`
              );
            }
          }

          const websiteConfiguration = {IndexDocument: {Suffix: this.indexPage}};
          if (this.errorPage) {
            websiteConfiguration.ErrorDocument = {Key: this.errorPage};
          }

          let currentWebsiteConfiguration;

          if (!hasBeenCreated) {
            const result = await getS3BucketWebsiteConfiguration(s3, bucketName);
            currentWebsiteConfiguration = pick(result, ['IndexDocument', 'ErrorDocument']);
          }

          let hasBeenUpdated;

          if (!isEqual(currentWebsiteConfiguration, websiteConfiguration)) {
            await s3.putBucketWebsite({
              Bucket: bucketName,
              WebsiteConfiguration: websiteConfiguration
            });
            hasBeenUpdated = true;
          }

          if (hasBeenCreated) {
            progress.setOutro('S3 bucket created');
          } else if (hasBeenUpdated) {
            progress.setOutro('S3 bucket updated');
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

    async configureCloudFrontDistribution({verbose, quiet, debug}) {
      const cloudFront = this.getCloudFrontClient();

      await task(
        async progress => {
          let distribution = await findCloudFrontDistribution(cloudFront, this.domainName, {
            verbose,
            quiet,
            debug
          });

          let distributionHasBeenCreated;

          if (!distribution) {
            progress.setMessage('Creating CloudFront distribution...');
            progress.setOutro('CloudFront distribution created');
            distribution = await this.createCloudFrontDistribution();
            distributionHasBeenCreated = true;
          }

          if (!distributionHasBeenCreated) {
            await this.checkCloudFrontDistributionTags(distribution, {verbose, quiet, debug});
          }

          if (!distributionHasBeenCreated && !distribution.Enabled) {
            throw new Error(
              `The CloudFront distribution is disabled (ARN: ${formatString(distribution.ARN)})`
            );
          }

          if (distributionHasBeenCreated || distribution.Status !== 'Deployed') {
            await waitUntilCloudFrontDistributionIsDeployed(cloudFront, distribution.Id, {
              verbose,
              quiet,
              debug
            });
          }
        },
        {
          intro: `Checking CloudFront distribution...`,
          outro: `CloudFront distribution checked`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async createCloudFrontDistribution() {
      const cloudFront = this.getCloudFrontClient();

      const params = {
        DistributionConfigWithTags: {
          DistributionConfig: {
            CallerReference: String(Date.now()),
            Aliases: {
              Quantity: 1,
              Items: [this.domainName]
            },
            Comment: '',
            Enabled: true,
            Origins: {
              Quantity: 1,
              Items: [
                {
                  DomainName: this.getS3WebsiteDomainName(),
                  Id: this.domainName,
                  CustomOriginConfig: {
                    HTTPPort: 80,
                    HTTPSPort: 443,
                    OriginProtocolPolicy: 'http-only'
                  }
                }
              ]
            },
            DefaultCacheBehavior: {
              TargetOriginId: this.domainName,
              ForwardedValues: {
                QueryString: false,
                Cookies: {Forward: 'none'}
              },
              ViewerProtocolPolicy: 'redirect-to-https',
              TrustedSigners: {
                Enabled: false,
                Quantity: 0
              },
              MinTTL: 0 // TODO: try to optimize this
            },
            PriceClass: this.aws.cloudFront.priceClass
          },
          Tags: {
            Items: [MANAGED_BY_TAG]
          }
        }
      };

      if (this.spa) {
        params.DistributionConfig.CustomErrorResponses = {
          Quantity: 1,
          Items: [
            {
              ErrorCode: 404,
              ResponseCode: '200',
              ResponsePagePath: '/' + this.indexPage
            }
          ]
        };
      }

      const result = await cloudFront.createDistributionWithTags(params);

      return result.Distribution;
    }

    async checkCloudFrontDistributionTags(distribution, {verbose, quiet, debug}) {
      const cloudFront = this.getCloudFrontClient();

      await task(
        async () => {
          const result = await cloudFront.listTagsForResource({Resource: distribution.ARN});
          if (!result.Tags.Items.some(tag => isEqual(tag, MANAGED_BY_TAG))) {
            throw new Error(
              `Can't use a CloudFront distribution not originally created by ${formatString(
                RESOURCE_ID
              )} (ARN: ${formatString(distribution.ARN)})`
            );
          }
        },
        {
          intro: `Checking CloudFront distribution tags...`,
          outro: `CloudFront distribution tags checked`,
          verbose,
          quiet,
          debug
        }
      );
    }

    getS3BucketName() {
      return this.domainName;
    }

    getS3WebsiteDomainName() {
      const region = (this.aws.s3 && this.aws.s3.region) || this.aws.region;
      return `${this.domainName}.s3-website-${region}.amazonaws.com`;
    }

    getS3Client() {
      if (!this._s3Client) {
        this._s3Client = new S3(this.aws);
      }
      return this._s3Client;
    }

    getCloudFrontClient() {
      if (!this._cloudFrontClient) {
        this._cloudFrontClient = new CloudFront(this.aws);
      }
      return this._cloudFrontClient;
    }
  };

async function ensureS3Buket(s3, bucketName) {
  let hasBeenCreated;
  try {
    await s3.createBucket({Bucket: bucketName, ACL: 'public-read'});
    hasBeenCreated = true;
  } catch (err) {
    if (err.code !== 'BucketAlreadyOwnedByYou') {
      throw err;
    }
  }
  return hasBeenCreated;
}

async function getS3BucketTags(s3, bucketName) {
  try {
    const {TagSet} = await s3.getBucketTagging({Bucket: bucketName});
    return TagSet;
  } catch (err) {
    if (err.code === 'NoSuchTagSet') {
      return [];
    }
    throw err;
  }
}

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

async function findCloudFrontDistribution(cloudFront, domainName, {verbose, quiet, debug}) {
  return await task(
    async progress => {
      const result = await cloudFront.listDistributions();

      if (result.DistributionList.IsTruncated) {
        throw new Error(
          'Wow, you have a lot of CloudFront distributions! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.'
        );
      }

      for (const distribution of result.DistributionList.Items) {
        if (distribution.Aliases.Items.includes(domainName)) {
          progress.setOutro('CloudFront distribution found');
          return distribution;
        }
      }

      progress.setOutro('CloudFront distribution not found');
    },
    {
      intro: `Searching for an existing CloudFront distribution...`,
      verbose,
      quiet,
      debug
    }
  );
}

async function waitUntilCloudFrontDistributionIsDeployed(
  cloudFront,
  distributionId,
  {verbose, quiet, debug}
) {
  return await task(
    async () => {
      await cloudFront.waitFor('distributionDeployed', {Id: distributionId});
    },
    {
      intro: `Waiting for deployment (be very patient, this operation can take up to 15 minutes)...`,
      outro: 'CloudFront distribution deployed',
      verbose,
      quiet,
      debug
    }
  );
}
