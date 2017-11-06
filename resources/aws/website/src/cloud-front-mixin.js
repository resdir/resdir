import {isEqual} from 'lodash';
import {task, formatString} from '@resdir/console';
import {CloudFront} from '@resdir/aws-client';

export default base =>
  class CloudFrontMixin extends base {
    static CLOUD_FRONT_HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2';

    async configureCloudFrontDistribution({verbose, quiet, debug}) {
      const cloudFront = this.getCloudFrontClient();

      await task(
        async progress => {
          let distribution = await this.findCloudFrontDistribution({
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

    _cloudFrontDistributions = {};

    async findCloudFrontDistribution({verbose, quiet, debug}) {
      let distribution = this._cloudFrontDistributions[this.domainName];
      if (!distribution) {
        distribution = await findCloudFrontDistribution(
          this.getCloudFrontClient(),
          this.domainName,
          {
            verbose,
            quiet,
            debug
          }
        );
        this._cloudFrontDistributions[this.domainName] = distribution;
      }
      return distribution;
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
            Items: [this.constructor.MANAGED_BY_TAG]
          }
        }
      };

      const {Distribution: distribution} = await cloudFront.createDistributionWithTags(params);

      this._cloudFrontDistributions[this.domainName] = distribution;

      return distribution;
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
          if (!result.Tags.Items.some(tag => isEqual(tag, this.constructor.MANAGED_BY_TAG))) {
            throw new Error(
              `Can't use a CloudFront distribution not originally created by ${formatString(
                this.constructor.RESOURCE_ID
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

    getCloudFrontClient() {
      if (!this._cloudFrontClient) {
        this._cloudFrontClient = new CloudFront(this.aws);
      }
      return this._cloudFrontClient;
    }
  };

async function findCloudFrontDistribution(cloudFront, domainName, {verbose, quiet, debug}) {
  return await task(
    async progress => {
      const result = await cloudFront.listDistributions();

      for (const distribution of result.DistributionList.Items) {
        if (distribution.Aliases.Items.includes(domainName)) {
          progress.setOutro('CloudFront distribution found');
          return distribution;
        }
      }

      if (result.DistributionList.IsTruncated) {
        throw new Error(
          'Wow, you have a lot of CloudFront distributions! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.'
        );
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
