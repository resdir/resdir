import {isEqual} from 'lodash';
import {task, formatString} from '@resdir/console';
import {CloudFront} from '@resdir/aws-client';
import sleep from 'sleep-promise';

const CACHING_MIN_TTL = 0;
const CACHING_DEFAULT_TTL = 86400; // 1 day
const CACHING_MAX_TTL = 3153600000; // 100 years
const ERROR_CACHING_MIN_TTL = 86400; // 1 day

export default base =>
  class CloudFrontMixin extends base {
    static CLOUD_FRONT_HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2';

    async configureCloudFrontDistribution(environment) {
      const cloudFront = this.getCloudFrontClient();

      let hasBeenCreated;

      let {distribution, status} = await this.checkCloudFrontDistribution(environment);

      if (status === 'NOT_FOUND') {
        distribution = await this.createCloudFrontDistribution(environment);
        hasBeenCreated = true;
        status = 'DEPLOYING';
      } else if (status === 'NEEDS_UPDATE') {
        await this.updateCloudFrontDistribution(distribution.Id, environment);
        status = 'DEPLOYING';
      }

      if (status === 'DEPLOYING') {
        await waitUntilCloudFrontDistributionIsDeployed(cloudFront, distribution.Id, environment);
      }

      return hasBeenCreated;
    }

    async checkCloudFrontDistribution(environment) {
      return await task(
        async () => {
          const distribution = await this.findCloudFrontDistribution(environment);
          if (!distribution) {
            return {status: 'NOT_FOUND'};
          }

          await this.checkCloudFrontDistributionTags(distribution, environment);

          if (!distribution.Enabled) {
            throw new Error(`The CloudFront distribution is disabled (ARN: ${formatString(distribution.ARN)})`);
          }

          if (await this.doesCloudFrontDistributionNeedUpdate(distribution)) {
            return {distribution, status: 'NEEDS_UPDATE'};
          }

          if (distribution.Status !== 'Deployed') {
            return {distribution, status: 'DEPLOYING'};
          }

          return {distribution, status: 'OKAY'};
        },
        {
          intro: `Checking CloudFront distribution...`,
          outro: `CloudFront distribution checked`
        },
        environment
      );
    }

    _cloudFrontDistributions = {};

    async findCloudFrontDistribution(environment) {
      let distribution = this._cloudFrontDistributions[this.domainName];
      if (!distribution) {
        distribution = await findCloudFrontDistribution(
          this.getCloudFrontClient(),
          this.domainName,
          environment
        );
        this._cloudFrontDistributions[this.domainName] = distribution;
      }
      return distribution;
    }

    async createCloudFrontDistribution(environment) {
      const cloudFront = this.getCloudFrontClient();

      let certificateARN = await this.findACMCertificate(environment);
      if (!certificateARN) {
        certificateARN = await this.requestACMCertificate(environment);
      }

      return await task(
        async () => {
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
                DefaultCacheBehavior: this.generateCloudFrontDistributionDefaultCacheBehavior(),
                CacheBehaviors: {Quantity: 0, Items: []},
                CustomErrorResponses: this.generateCloudFrontDistributionCustomErrorResponses(),
                Comment: '',
                Logging: {Enabled: false, IncludeCookies: false, Bucket: '', Prefix: ''},
                PriceClass: this.aws.cloudFront.priceClass,
                Enabled: true,
                ViewerCertificate: {
                  ACMCertificateArn: certificateARN,
                  SSLSupportMethod: 'sni-only',
                  MinimumProtocolVersion: 'TLSv1',
                  Certificate: certificateARN,
                  CertificateSource: 'acm'
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
        },
        {
          intro: `Creating CloudFront distribution...`,
          outro: `CloudFront distribution created`
        },
        environment
      );
    }

    async doesCloudFrontDistributionNeedUpdate(distribution) {
      if (!isEqual(distribution.Origins, this.generateCloudFrontDistributionOrigins())) {
        return true;
      }

      if (
        !isEqual(
          distribution.DefaultCacheBehavior,
          this.generateCloudFrontDistributionDefaultCacheBehavior()
        )
      ) {
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

    async updateCloudFrontDistribution(distributionId, environment) {
      const cloudFront = this.getCloudFrontClient();

      await task(
        async () => {
          const {DistributionConfig: config, ETag: eTag} = await cloudFront.getDistributionConfig({
            Id: distributionId
          });

          config.Origins = this.generateCloudFrontDistributionOrigins();

          config.DefaultCacheBehavior = this.generateCloudFrontDistributionDefaultCacheBehavior();

          config.CustomErrorResponses = this.generateCloudFrontDistributionCustomErrorResponses();

          config.PriceClass = this.aws.cloudFront.priceClass;

          await cloudFront.updateDistribution({
            Id: distributionId,
            IfMatch: eTag,
            DistributionConfig: config
          });
        },
        {
          intro: `Updating CloudFront distribution...`,
          outro: `CloudFront distribution updated`
        },
        environment
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
              OriginKeepaliveTimeout: 30
            }
          }
        ]
      };
    }

    generateCloudFrontDistributionDefaultCacheBehavior() {
      return {
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
        MinTTL: CACHING_MIN_TTL,
        DefaultTTL: CACHING_DEFAULT_TTL,
        MaxTTL: CACHING_MAX_TTL,
        Compress: true,
        LambdaFunctionAssociations: {Quantity: 0, Items: []}
      };
    }

    generateCloudFrontDistributionCustomErrorResponses() {
      const items = [];

      for (const {errorCode, responseCode, responsePage} of this.customErrors || []) {
        const item = {
          ErrorCode: Number(errorCode),
          ErrorCachingMinTTL: ERROR_CACHING_MIN_TTL
        };

        if (responseCode) {
          item.ResponseCode = String(responseCode);
        }

        if (responsePage) {
          item.ResponsePagePath = '/' + responsePage;
          if (!responseCode) {
            item.ResponseCode = String(errorCode);
          }
        }

        items.push(item);
      }

      return {
        Quantity: items.length,
        Items: items
      };
    }

    async checkCloudFrontDistributionTags(distribution, environment) {
      const cloudFront = this.getCloudFrontClient();

      await task(
        async () => {
          const result = await cloudFront.listTagsForResource({Resource: distribution.ARN});
          if (!result.Tags.Items.some(tag => isEqual(tag, this.constructor.MANAGED_BY_TAG))) {
            throw new Error(`Can't use a CloudFront distribution not originally created by ${formatString(this.constructor.RESOURCE_ID)} (ARN: ${formatString(distribution.ARN)})`);
          }
        },
        {
          intro: `Checking CloudFront distribution tags...`,
          outro: `CloudFront distribution tags checked`
        },
        environment
      );
    }

    async runCloudFrontInvalidation(changes, environment) {
      if (changes.length === 0) {
        return;
      }

      const cloudFront = this.getCloudFrontClient();

      const paths = [];
      for (const change of changes) {
        paths.push('/' + change);
        if (change.endsWith('/' + this.indexPage)) {
          // 'section/index.html' => /section/
          paths.push('/' + change.slice(0, -this.indexPage.length));
        }
      }

      await task(
        async () => {
          const distribution = await this.findCloudFrontDistribution(environment);
          const {Invalidation: invalidation} = await cloudFront.createInvalidation({
            DistributionId: distribution.Id,
            InvalidationBatch: {
              CallerReference: String(Date.now()),
              Paths: {
                Quantity: paths.length,
                Items: paths
              }
            }
          });
          const quietEnvironment = await environment.$extend({'@quiet': true});
          await waitUntilCloudFrontInvalidationIsCompleted(
            cloudFront,
            distribution.Id,
            invalidation.Id,
            quietEnvironment
          );
        },
        {
          intro: `Running CloudFront invalidation...`,
          outro: `CloudFront invalidation completed`
        },
        environment
      );
    }

    async getCloudFrontDomainName(environment) {
      const distribution = await this.findCloudFrontDistribution(environment);
      return distribution && distribution.DomainName;
    }

    getCloudFrontClient() {
      if (!this._cloudFrontClient) {
        this._cloudFrontClient = new CloudFront(this.aws);
      }
      return this._cloudFrontClient;
    }
  };

async function findCloudFrontDistribution(cloudFront, domainName, environment) {
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
        throw new Error('Wow, you have a lot of CloudFront distributions! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.');
      }

      progress.setOutro('CloudFront distribution not found');
    },
    {
      intro: `Searching for an existing CloudFront distribution...`
    },
    environment
  );
}

async function waitUntilCloudFrontDistributionIsDeployed(cloudFront, distributionId, environment) {
  return await task(
    async () => {
      await cloudFront.waitFor('distributionDeployed', {Id: distributionId});
    },
    {
      intro: `Waiting for CloudFront deployment (be patient, it can take up to 15 minutes)...`,
      outro: 'CloudFront distribution deployed'
    },
    environment
  );
}

async function waitUntilCloudFrontInvalidationIsCompleted(
  cloudFront,
  distributionId,
  invalidationId,
  environment
) {
  await task(
    async () => {
      const sleepTime = 10000; // 10 seconds
      const maxSleepTime = 5 * 60 * 1000; // 5 minutes
      let totalSleepTime = 0;
      do {
        await sleep(sleepTime);
        totalSleepTime += sleepTime;
        const {Invalidation: invalidation} = await cloudFront.getInvalidation({
          DistributionId: distributionId,
          Id: invalidationId
        });
        if (invalidation.Status === 'Completed') {
          return;
        }
      } while (totalSleepTime <= maxSleepTime);
      throw new Error(`CloudFront invalidation uncompleted after ${totalSleepTime / 1000} seconds`);
    },
    {
      intro: `Waiting for CloudFront invalidation completion...`,
      outro: `CloudFront invalidation completed`
    },
    environment
  );
}
