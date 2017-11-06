import {takeRight} from 'lodash';
import {task, formatString} from '@resdir/console';
import {Route53} from '@resdir/aws-client';

export default base =>
  class Route53Mixin extends base {
    async configureRoute53HostedZone({verbose, quiet, debug}) {
      const route53 = this.getRoute53Client();

      await task(
        async progress => {
          const hostedZone = await findRoute53HostedZone(route53, this.domainName, {
            verbose,
            quiet,
            debug
          });

          if (!hostedZone) {
            throw new Error(
              `Sorry, the current implementation of this tool requires a Route 53 hosted zone matching your domain name (${formatString(
                this.domainName
              )})`
            );
          }

          const cloudFrontDistribution = await this.findCloudFrontDistribution({
            verbose,
            quiet,
            debug
          });

          const recordSet = await findRoute53RecordSet(
            {route53, hostedZoneId: hostedZone.Id, domainName: this.domainName},
            {
              verbose,
              quiet,
              debug
            }
          );

          let changeRequired;

          if (!recordSet) {
            progress.setMessage('Creating Route53 record set...');
            progress.setOutro('Route53 record set created');
            changeRequired = true;
          } else if (
            !(
              recordSet.AliasTarget &&
              recordSet.AliasTarget.DNSName === cloudFrontDistribution.DomainName + '.'
            )
          ) {
            progress.setMessage('Updating Route53 record set...');
            progress.setOutro('Route53 record set updated');
            changeRequired = true;
          }

          if (changeRequired) {
            await route53.changeResourceRecordSets({
              HostedZoneId: hostedZone.Id,
              ChangeBatch: {
                Changes: [
                  {
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                      AliasTarget: {
                        DNSName: cloudFrontDistribution.DomainName + '.',
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
            // TODO: waitFor DNS update
          }
        },
        {
          intro: `Checking Route53 hosted zone...`,
          outro: `Route53 hosted zone checked`,
          verbose,
          quiet,
          debug
        }
      );
    }

    getRoute53Client() {
      if (!this._route53Client) {
        this._route53Client = new Route53(this.aws);
      }
      return this._route53Client;
    }
  };

async function findRoute53HostedZone(route53, domainName, {verbose, quiet, debug}) {
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
        throw new Error(
          'Wow, you have a lot of Route 53 hosted zones! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.'
        );
      }

      progress.setOutro('Route 53 hosted zone not found');
    },
    {
      intro: `Searching for the Route 53 hosted zone...`,
      verbose,
      quiet,
      debug
    }
  );
}

async function findRoute53RecordSet(
  {route53, hostedZoneId, domainName, type = 'A'},
  {verbose, quiet, debug}
) {
  const name = domainName + '.';

  return await task(
    async progress => {
      const result = await route53.listResourceRecordSets({
        HostedZoneId: hostedZoneId,
        StartRecordName: name,
        StartRecordType: type
      });

      const recordSet = result.ResourceRecordSets.find(
        recordSet => recordSet.Name === name && recordSet.Type === type
      );

      if (recordSet) {
        progress.setOutro('Route 53 record set found');
        return recordSet;
      }

      if (result.IsTruncated) {
        throw new Error(
          'Wow, you have a lot of Route 53 record sets! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.'
        );
      }

      progress.setOutro('Route 53 record set not found');
    },
    {
      intro: `Searching for the Route 53 record set...`,
      verbose,
      quiet,
      debug
    }
  );
}