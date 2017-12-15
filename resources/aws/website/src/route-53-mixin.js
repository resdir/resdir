import {takeRight} from 'lodash';
import {task} from '@resdir/console';
import {Route53} from '@resdir/aws-client';
import sleep from 'sleep-promise';

export default base =>
  class Route53Mixin extends base {
    async configureRoute53HostedZone(environment) {
      const route53 = this.getRoute53Client();

      return await task(
        async progress => {
          const hostedZone = await findRoute53HostedZone(route53, this.domainName, environment);

          if (!hostedZone) {
            return false;
          }

          const cloudFrontDomainName = await this.getCloudFrontDomainName(environment);

          const recordSet = await findRoute53RecordSet(
            {route53, hostedZoneId: hostedZone.Id, domainName: this.domainName},
            environment
          );

          let changeRequired;

          if (!recordSet) {
            progress.setMessage('Creating Route53 record set...');
            progress.setOutro('Route53 record set created');
            changeRequired = true;
          } else if (
            !(recordSet.AliasTarget && recordSet.AliasTarget.DNSName === cloudFrontDomainName + '.')
          ) {
            progress.setMessage('Updating Route53 record set...');
            progress.setOutro('Route53 record set updated');
            changeRequired = true;
          }

          if (changeRequired) {
            const {ChangeInfo: changeInfo} = await route53.changeResourceRecordSets({
              HostedZoneId: hostedZone.Id,
              ChangeBatch: {
                Changes: [
                  {
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                      AliasTarget: {
                        DNSName: cloudFrontDomainName + '.',
                        EvaluateTargetHealth: false,
                        HostedZoneId: this.constructor.CLOUD_FRONT_HOSTED_ZONE_ID
                      },
                      Name: this.domainName + '.',
                      Type: 'A'
                    }
                  }
                ]
              }
            });

            await waitUntilRoute53RecordSetIsChanged(route53, changeInfo.Id, environment);
          }

          return true;
        },
        {
          intro: `Checking Route53 hosted zone...`,
          outro: `Route53 hosted zone checked`
        },
        environment
      );
    }

    getRoute53Client() {
      if (!this._route53Client) {
        this._route53Client = new Route53(this.aws);
      }
      return this._route53Client;
    }
  };

async function findRoute53HostedZone(route53, domainName, environment) {
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
        return bestHostedZone;
      }

      if (result.IsTruncated) {
        throw new Error('Wow, you have a lot of Route 53 hosted zones! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.');
      }

      progress.setOutro('Route 53 hosted zone not found');
    },
    {
      intro: `Searching for the Route 53 hosted zone...`
    },
    environment
  );
}

async function findRoute53RecordSet({route53, hostedZoneId, domainName, type = 'A'}, environment) {
  const name = domainName + '.';

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
        throw new Error('Wow, you have a lot of Route 53 record sets! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.');
      }

      progress.setOutro('Route 53 record set not found');
    },
    {
      intro: `Searching for the Route 53 record set...`
    },
    environment
  );
}

async function waitUntilRoute53RecordSetIsChanged(route53, changeId, environment) {
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
      throw new Error(`Route 53 record set change uncompleted after ${totalSleepTime / 1000} seconds`);
    },
    {
      intro: `Waiting for Route 53 record set change to complete...`,
      outro: `Route 53 record set change completed`
    },
    environment
  );
}
