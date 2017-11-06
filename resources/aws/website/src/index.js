import {resolve, relative} from 'path';
import {statSync, createReadStream} from 'fs';
import {pick, isEqual} from 'lodash';
import {task, formatString, formatCode, formatPath, formatMessage} from '@resdir/console';
import {S3, getS3WebsiteDomainName, CloudFront} from '@resdir/aws-client';
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
              Tagging: {TagSet: [MANAGED_BY_TAG]}
            });
            hasBeenCreated = true;
          }

          if (!hasBeenCreated && !tags.some(tag => isEqual(tag, MANAGED_BY_TAG))) {
            throw new Error(
              `Can't use a S3 bucket not originally created by ${formatString(
                RESOURCE_ID
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
          if (this.errorPage) {
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

    async configureCloudFrontDistribution({verbose, quiet, debug}) {
      const cloudFront = this.getCloudFrontClient();

      await task(
        async progress => {
          let distribution = await findCloudFrontDistribution(cloudFront, this.domainName, {
            verbose,
            quiet,
            debug
          });

          let hasBeenCreated;
          if (!distribution) {
            progress.setMessage('Creating CloudFront distribution...');
            progress.setOutro('CloudFront distribution created');
            distribution = await this.createCloudFrontDistribution();
            hasBeenCreated = true;
          }

          if (!hasBeenCreated) {
            await this.checkCloudFrontDistributionTags(distribution, {verbose, quiet, debug});
          }

          if (!hasBeenCreated && !distribution.Enabled) {
            throw new Error(
              `The CloudFront distribution is disabled (ARN: ${formatString(distribution.ARN)})`
            );
          }

          if (hasBeenCreated || distribution.Status !== 'Deployed') {
            await waitUntilCloudFrontDistributionIsDeployed(cloudFront, distribution.Id, {
              verbose,
              quiet,
              debug
            });
          }

          if (!hasBeenCreated) {
            const needsUpdate = await this.doesCloudFrontDistributionNeedUpdate(distribution);
            if (needsUpdate) {
              progress.setMessage('Updating CloudFront distribution...');
              progress.setOutro('CloudFront distribution updated');
              await this.updateCloudFrontDistribution(distribution.Id);
              await waitUntilCloudFrontDistributionIsDeployed(cloudFront, distribution.Id, {
                verbose,
                quiet,
                debug
              });
            }
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
            DefaultRootObject: this.indexPage,
            Origins: this.generateCloudFrontDistributionOrigins(),
            DefaultCacheBehavior: {
              TargetOriginId: this.domainName,
              ForwardedValues: {
                QueryString: false,
                Cookies: {Forward: 'none'},
                Headers: {Quantity: 0, Items: []},
                QueryStringCacheKeys: {Quantity: 0, Items: []}
              },
              TrustedSigners: {Enabled: false, Quantity: 0, Items: []},
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: {
                Quantity: 2,
                Items: ['HEAD', 'GET'],
                CachedMethods: {Quantity: 2, Items: ['HEAD', 'GET']}
              },
              SmoothStreaming: false,
              MinTTL: 0,
              DefaultTTL: 0,
              MaxTTL: 31536000,
              Compress: true,
              LambdaFunctionAssociations: {Quantity: 0, Items: []}
            },
            CacheBehaviors: {Quantity: 0, Items: []},
            CustomErrorResponses: this.generateCloudFrontDistributionCustomErrorResponses(),
            Comment: '',
            Logging: {Enabled: false, IncludeCookies: false, Bucket: '', Prefix: ''},
            PriceClass: this.aws.cloudFront.priceClass,
            Enabled: true,
            ViewerCertificate: {
              CloudFrontDefaultCertificate: true,
              MinimumProtocolVersion: 'TLSv1',
              CertificateSource: 'cloudfront'
            },
            Restrictions: {GeoRestriction: {RestrictionType: 'none', Quantity: 0, Items: []}},
            WebACLId: '',
            HttpVersion: 'http2',
            IsIPV6Enabled: true
          },
          Tags: {
            Items: [MANAGED_BY_TAG]
          }
        }
      };

      const result = await cloudFront.createDistributionWithTags(params);

      return result.Distribution;
    }

    async doesCloudFrontDistributionNeedUpdate(distribution) {
      if (!isEqual(distribution.Origins, this.generateCloudFrontDistributionOrigins())) {
        return true;
      }

      if (
        !isEqual(
          distribution.CustomErrorResponses,
          this.generateCloudFrontDistributionCustomErrorResponses()
        )
      ) {
        return true;
      }

      if (distribution.PriceClass !== this.aws.cloudFront.priceClass) {
        return true;
      }

      return false;
    }

    async updateCloudFrontDistribution(distributionId) {
      const cloudFront = this.getCloudFrontClient();

      const {DistributionConfig: config, ETag: eTag} = await cloudFront.getDistributionConfig({
        Id: distributionId
      });

      config.Origins = this.generateCloudFrontDistributionOrigins();

      config.CustomErrorResponses = this.generateCloudFrontDistributionCustomErrorResponses();

      config.PriceClass = this.aws.cloudFront.priceClass;

      await cloudFront.updateDistribution({
        Id: distributionId,
        IfMatch: eTag,
        DistributionConfig: config
      });
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

    generateCloudFrontDistributionOrigins() {
      return {
        Quantity: 1,
        Items: [
          {
            Id: this.domainName,
            DomainName: this.getS3WebsiteDomainName(),
            OriginPath: '',
            CustomHeaders: {Quantity: 0, Items: []},
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: 'http-only',
              OriginSslProtocols: {Quantity: 3, Items: ['TLSv1', 'TLSv1.1', 'TLSv1.2']},
              OriginReadTimeout: 30,
              OriginKeepaliveTimeout: this.spa ? 5 : 30
            }
          }
        ]
      };
    }

    generateCloudFrontDistributionCustomErrorResponses() {
      const items = [];
      if (this.spa) {
        items.push({
          ErrorCode: 404,
          ResponseCode: '200',
          ResponsePagePath: '/' + this.indexPage,
          ErrorCachingMinTTL: 0
        });
      }
      return {
        Quantity: items.length,
        Items: items
      };
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

    getCloudFrontClient() {
      if (!this._cloudFrontClient) {
        this._cloudFrontClient = new CloudFront(this.aws);
      }
      return this._cloudFrontClient;
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
      intro: `Waiting for deployment (be patient, it can take up to 15 minutes)...`,
      outro: 'CloudFront distribution deployed',
      verbose,
      quiet,
      debug
    }
  );
}
