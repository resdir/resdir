import dns from 'dns';
import {task} from '@resdir/console';

export default base =>
  class ExternalDNSMixin extends base {
    async checkCNAME({verbose, quiet, debug}) {
      return await task(
        async progress => {
          const values = await dnsResolve(this.domainName, 'CNAME');
          const cloudFrontDomainName = await this.getCloudFrontDomainName({quiet: true});
          if (values && values.includes(cloudFrontDomainName)) {
            return true;
          }
          progress.setOutro('Domain name not configured');
        },
        {
          intro: `Checking domain name...`,
          outro: `Domain name checked`,
          verbose,
          quiet,
          debug
        }
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
