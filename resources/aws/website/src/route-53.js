import {task} from '@resdir/console';
import {Route53} from '@resdir/aws-client';
import {ensureRoute53Alias, ensureRoute53CNAME, checkCNAME} from '@resdir/aws-helpers';

const CLOUD_FRONT_HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2';

export default () => ({
  async configureDomainName(environment) {
    return await task(
      async progress => {
        const route53 = this.getRoute53Client();

        const cloudFrontDomainName = await this.getCloudFrontDomainName(environment);

        let result = await ensureRoute53Alias(
          {
            name: this.domainName,
            targetDomainName: cloudFrontDomainName,
            targetHostedZoneId: CLOUD_FRONT_HOSTED_ZONE_ID,
            route53
          },
          environment
        );

        if (result) {
          return result;
        }

        result = await checkCNAME(
          {name: this.domainName, value: cloudFrontDomainName},
          environment
        );

        if (result) {
          return result;
        }

        progress.setOutro('Domain name not configured');
      },
      {
        intro: `Checking domain name...`,
        outro: `Domain name checked`
      },
      environment
    );
  },

  async ensureRoute53CNAME({name, value}, environment) {
    return await ensureRoute53CNAME({name, value, route53: this.getRoute53Client()}, environment);
  },

  getRoute53Client() {
    if (!this._route53Client) {
      this._route53Client = new Route53(this.aws);
    }
    return this._route53Client;
  }
});
