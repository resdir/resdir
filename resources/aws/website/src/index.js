import {formatCode} from '@resdir/console';

import S3Mixin from './s3-mixin';
import CloudFrontMixin from './cloud-front-mixin';
import Route53Mixin from './route-53-mixin';

export default base =>
  class AWSWebsite extends Route53Mixin(CloudFrontMixin(S3Mixin(base))) {
    static RESOURCE_ID = 'aws/website';
    static MANAGED_BY_TAG = {Key: 'managed-by', Value: 'aws-website-resource-v1'};

    async deploy(_args, {verbose, quiet, debug}) {
      if (!this.domainName) {
        throw new Error(`${formatCode('domainName')} property is missing`);
      }

      // await this.configureS3Bucket({verbose, quiet, debug});
      // await this.synchronizeFiles({verbose, quiet, debug});
      // await this.configureCloudFrontDistribution({verbose, quiet, debug});
      await this.configureRoute53HostedZone({verbose, quiet, debug});
    }
  };
