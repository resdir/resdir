import {trimEnd, takeRight} from 'lodash';
import {task} from '@resdir/console';
import {createClientError} from '@resdir/error';
import sleep from 'sleep-promise';

export async function ensureRoute53CNAME({name, value, route53}, environment) {
  name = trimEnd(name, '.');
  value = trimEnd(value, '.');

  return await task(
    async progress => {
      const hostedZone = await findRoute53HostedZone({domainName: name, route53}, environment);
      if (!hostedZone) {
        return false;
      }

      const recordSet = await findRoute53RecordSet(
        {hostedZoneId: hostedZone.id, name, type: 'CNAME', route53},
        environment
      );

      let changeRequired;

      if (!recordSet) {
        progress.setMessage('Creating Route53 CNAME...');
        progress.setOutro('Route53 CNAME created');
        changeRequired = true;
      } else if (
        !(
          recordSet.ResourceRecords &&
          recordSet.ResourceRecords[0] &&
          recordSet.ResourceRecords[0].Value === value
        )
      ) {
        progress.setMessage('Updating Route53 CNAME...');
        progress.setOutro('Route53 CNAME updated');
        changeRequired = true;
      }

      if (changeRequired) {
        const {ChangeInfo: {Id: changeId}} = await route53.changeResourceRecordSets({
          HostedZoneId: hostedZone.id,
          ChangeBatch: {
            Changes: [
              {
                Action: 'UPSERT',
                ResourceRecordSet: {
                  Name: name + '.',
                  Type: 'CNAME',
                  ResourceRecords: [{Value: value}],
                  TTL: 300
                }
              }
            ]
          }
        });

        await waitUntilRoute53RecordSetIsChanged({changeId, route53}, environment);
      }

      return true;
    },
    {
      intro: `Checking Route53 CNAME...`,
      outro: `Route53 CNAME checked`
    },
    environment
  );
}

export async function ensureRoute53Alias(
  {name, targetDomainName, targetHostedZoneId, route53},
  environment
) {
  name = trimEnd(name, '.');
  targetDomainName = trimEnd(targetDomainName, '.');

  return await task(
    async progress => {
      const hostedZone = await findRoute53HostedZone({domainName: name, route53}, environment);
      if (!hostedZone) {
        return false;
      }

      const recordSet = await findRoute53RecordSet(
        {hostedZoneId: hostedZone.id, name, type: 'A', route53},
        environment
      );

      let changeRequired;

      if (!recordSet) {
        progress.setMessage('Creating Route53 Alias...');
        progress.setOutro('Route53 Alias created');
        changeRequired = true;
      } else if (
        !(recordSet.AliasTarget && recordSet.AliasTarget.DNSName === targetDomainName + '.')
      ) {
        progress.setMessage('Updating Route53 Alias...');
        progress.setOutro('Route53 Alias updated');
        changeRequired = true;
      }

      if (changeRequired) {
        const {ChangeInfo: {Id: changeId}} = await route53.changeResourceRecordSets({
          HostedZoneId: hostedZone.id,
          ChangeBatch: {
            Changes: [
              {
                Action: 'UPSERT',
                ResourceRecordSet: {
                  Name: name + '.',
                  Type: 'A',
                  AliasTarget: {
                    DNSName: targetDomainName + '.',
                    HostedZoneId: targetHostedZoneId,
                    EvaluateTargetHealth: false
                  }
                }
              }
            ]
          }
        });

        await waitUntilRoute53RecordSetIsChanged({changeId, route53}, environment);
      }

      return true;
    },
    {
      intro: `Checking Route53 Alias...`,
      outro: `Route53 Alias checked`
    },
    environment
  );
}

async function findRoute53HostedZone({domainName, route53}, environment) {
  return await task(
    async progress => {
      const dnsName = takeRight(domainName.split('.'), 2).join('.');

      const result = await route53.listHostedZonesByName({DNSName: dnsName});

      let bestHostedZone;
      for (const hostedZone of result.HostedZones) {
        if (
          domainName + '.' === hostedZone.Name ||
          (domainName + '.').endsWith('.' + hostedZone.Name)
        ) {
          if (!bestHostedZone || hostedZone.Name.length > bestHostedZone.Name.length) {
            bestHostedZone = hostedZone;
          }
        }
      }

      if (bestHostedZone) {
        progress.setOutro('Route 53 hosted zone found');
        return {id: bestHostedZone.Id};
      }

      if (result.IsTruncated) {
        throw createClientError(`Whoa, you have a lot of Route 53 hosted zones! Unfortunately, this tool can't list them all. Please post an issue on Resdir's GitHub if this is a problem for you.`);
      }

      progress.setOutro('Route 53 hosted zone not found');
    },
    {
      intro: `Searching for the Route 53 hosted zone...`
    },
    environment
  );
}

async function findRoute53RecordSet({hostedZoneId, name, type, route53}, environment) {
  name += '.';

  return await task(
    async progress => {
      const result = await route53.listResourceRecordSets({
        HostedZoneId: hostedZoneId,
        StartRecordName: name,
        StartRecordType: type
      });

      const recordSet = result.ResourceRecordSets.find(recordSet => recordSet.Name === name && recordSet.Type === type);

      if (recordSet) {
        progress.setOutro('Route 53 record set found');
        return recordSet;
      }

      if (result.IsTruncated) {
        throw createClientError(`Whoa, you have a lot of Route 53 record sets! Unfortunately, this tool can't list them all. Please post an issue on Resdir's GitHub if this is a problem for you.`);
      }

      progress.setOutro('Route 53 record set not found');
    },
    {
      intro: `Searching for the Route 53 record set...`
    },
    environment
  );
}

async function waitUntilRoute53RecordSetIsChanged({changeId, route53}, environment) {
  await task(
    async () => {
      const sleepTime = 5000; // 5 seconds
      const maxSleepTime = 3 * 60 * 1000; // 3 minutes
      let totalSleepTime = 0;
      do {
        await sleep(sleepTime);
        totalSleepTime += sleepTime;
        const {ChangeInfo: changeInfo} = await route53.getChange({Id: changeId});
        if (changeInfo.Status !== 'PENDING') {
          return;
        }
      } while (totalSleepTime <= maxSleepTime);
      throw createClientError(`Route 53 record set change uncompleted after ${totalSleepTime / 1000} seconds`);
    },
    {
      intro: `Waiting for Route 53 record set change to complete...`,
      outro: `Route 53 record set change completed`
    },
    environment
  );
}
