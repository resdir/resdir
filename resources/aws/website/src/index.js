import {
  print,
  emptyLine,
  printText,
  formatString,
  formatCode,
  formatURL,
  formatBold,
  formatDim
} from '@resdir/console';

import S3Mixin from './s3-mixin';
import ACMMixin from './acm-mixin';
import CloudFrontMixin from './cloud-front-mixin';
import Route53Mixin from './route-53-mixin';
import ExternalDNSMixin from './external-dns-mixin';

export default base =>
  class AWSWebsite extends ExternalDNSMixin(
    Route53Mixin(CloudFrontMixin(ACMMixin(S3Mixin(base))))
  ) {
    static RESOURCE_ID = 'aws/website';

    static MANAGED_BY_TAG = {Key: 'managed-by', Value: 'aws-website-v1'};

    async deploy(_args, environment) {
      this.validate();

      await this.configureS3Bucket(environment);

      const changes = await this.synchronizeFiles(environment);

      const hasBeenCreated = await this.configureCloudFrontDistribution(environment);

      if (!hasBeenCreated && changes.length > 0) {
        await this.runCloudFrontInvalidation(changes, environment);
      }

      let domainNameConfigured = await this.configureRoute53HostedZone(environment);
      if (!domainNameConfigured) {
        domainNameConfigured = await this.checkCNAME(environment);
      }

      if (hasBeenCreated) {
        emptyLine();
        print(`${formatBold('Success!')} 🎉`);
      }

      if (hasBeenCreated || !domainNameConfigured) {
        if (domainNameConfigured) {
          emptyLine();
          print(`Your website is fully deployed at ${formatURL('https://' + this.domainName)}`);
          emptyLine();
        } else {
          const quietEnvironment = environment.$extend({'@quiet': true});
          const cloudFrontDomainName = await this.getCloudFrontDomainName(quietEnvironment);
          emptyLine();
          printText(
            `Your website is fully deployed, but since the name servers associated with your domain name don't seem to be managed by Route 53, you need to configure them manually by adding a CNAME record pointing to the CloudFront domain name:`,
            {width: 80}
          );
          emptyLine();
          print(`   ${formatDim('Name:')} ${formatString(this.domainName)}`);
          print(`   ${formatDim('Type:')} ${formatString('CNAME')}`);
          print(`  ${formatDim('Value:')} ${formatString(cloudFrontDomainName)}`);
          emptyLine();
        }
      }
    }

    validate() {
      if (!this.domainName) {
        throw new Error(`${formatCode('domainName')} property is missing`);
      }

      if (!this.indexPage) {
        throw new Error(`${formatCode('indexPage')} property is missing`);
      }

      if (this.indexPage.startsWith('/') || this.indexPage.startsWith('.')) {
        throw new Error(
          `${formatCode('indexPage')} can't start with ${formatString('/')} or ${formatString('.')}`
        );
      }

      for (const {errorCode, responseCode, responsePage} of this.customErrors || []) {
        if (!errorCode) {
          throw new Error(
            `${formatCode('errorCode')} is missing in ${formatCode('customErrors')} property`
          );
        }

        if (responseCode && !responsePage) {
          throw new Error(
            `${formatCode('responsePage')} is missing in ${formatCode('customErrors')} property`
          );
        }

        if (responsePage && (responsePage.startsWith('/') || responsePage.startsWith('.'))) {
          throw new Error(
            `${formatCode('responsePage')} in ${formatCode(
              'customErrors'
            )} property can't start with ${formatString('/')} or ${formatString('.')}`
          );
        }
      }
    }
  };
