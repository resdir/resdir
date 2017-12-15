import dns from 'dns';
import {task} from '@resdir/console';

export default base =>
  class ExternalDNSMixin extends base {
    async checkCNAME(environment) {
      return await task(
        async progress => {
          const values = await dnsResolve(this.domainName, 'CNAME');
          const quietEnvironment = await environment.$extend({'@quiet': true});
          const cloudFrontDomainName = await this.getCloudFrontDomainName(quietEnvironment);
          if (values && values.includes(cloudFrontDomainName)) {
            return true;
          }
          progress.setOutro('Domain name not configured');
        },
        {
          intro: `Checking domain name...`,
          outro: `Domain name checked`
        },
        environment
      );
    }
  };

function dnsResolve(hostname, rrtype) {
  return new Promise(resolve => {
    dns.resolve(hostname, rrtype, (err, result) => {
      resolve(err ? undefined : result);
    });
  });
}
