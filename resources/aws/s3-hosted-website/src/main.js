import {
  print,
  emptyLine,
  printText,
  formatString,
  formatURL,
  formatBold,
  formatDim
} from '@resdir/console';

export default () => ({
  RESOURCE_ID: 'aws/s3-hosted-website',

  MANAGER_IDENTIFIER: 'aws-s3-hosted-website-v1',

  async deploy(_args, environment) {
    await this.configureS3Bucket(environment);

    const changes = await this.synchronizeFiles(environment);

    const hasBeenCreated = await this.configureCloudFrontDistribution(environment);

    if (!hasBeenCreated && changes.length > 0) {
      await this.runCloudFrontInvalidation(changes, environment);
    }

    const domainNameConfigured = await this.configureDomainName(environment);

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
        printText(`Your website is fully deployed, but since the name servers associated with your domain name don't seem to be managed by Route 53, you need to configure them manually by adding a CNAME record pointing to the CloudFront domain name:`);
        emptyLine();
        print(`   ${formatDim('Name:')} ${formatString(this.domainName)}`);
        print(`   ${formatDim('Type:')} ${formatString('CNAME')}`);
        print(`  ${formatDim('Value:')} ${formatString(cloudFrontDomainName)}`);
        emptyLine();
      }
    }
  }
});
