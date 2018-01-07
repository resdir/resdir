import {Resolver} from 'dns';
import {task} from '@resdir/console';

const defaultResolver = new Resolver();

const googleResolver = new Resolver();
googleResolver.setServers(['8.8.8.8']);

export async function checkCNAME({name, value}, environment) {
  return await task(
    async progress => {
      let values;

      values = await dnsResolve(name, 'CNAME');
      if (values && values.includes(value)) {
        return true;
      }

      values = await dnsResolve(name, 'CNAME', {resolver: googleResolver});
      if (values && values.includes(value)) {
        return true;
      }

      progress.setOutro('CNAME not found');
    },
    {
      intro: `Checking CNAME...`,
      outro: `CNAME found`
    },
    environment
  );
}

function dnsResolve(hostname, rrtype, {resolver = defaultResolver} = {}) {
  return new Promise(resolve => {
    resolver.resolve(hostname, rrtype, (err, result) => {
      resolve(err ? undefined : result);
    });
  });
}
