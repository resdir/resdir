import {sortBy, isEqual} from 'lodash';
import {task, formatString} from '@resdir/console';
import {ACM} from '@resdir/aws-client';
import sleep from 'sleep-promise';

export default base =>
  class ACMMixin extends base {
    async findACMCertificate(environment) {
      const acm = this.getACMClient();

      const certificate = await findACMCertificate(
        acm,
        this.domainName,
        this.constructor.MANAGED_BY_TAG,
        environment
      );

      if (!certificate) {
        return undefined;
      }

      if (certificate.Status === 'PENDING_VALIDATION') {
        await waitUntilACMCertificateIsIssued(acm, certificate.CertificateArn, environment);
      }

      return certificate.CertificateArn;
    }

    async requestACMCertificate(environment) {
      const acm = this.getACMClient();

      const certificateARN = await task(
        async () => {
          const {CertificateArn: certificateARN} = await acm.requestCertificate({
            DomainName: this.domainName
          });
          await acm.addTagsToCertificate({
            CertificateArn: certificateARN,
            Tags: [this.constructor.MANAGED_BY_TAG]
          });
          return certificateARN;
        },
        {
          intro: `Requesting ACM certificate for ${formatString(this.domainName)}...`,
          outro: `ACM certificate requested for ${formatString(this.domainName)}`
        },
        environment
      );

      await waitUntilACMCertificateIsIssued(acm, certificateARN, environment);

      return certificateARN;
    }

    getACMClient() {
      if (!this._acmClient) {
        this._acmClient = new ACM(this.aws);
      }
      return this._acmClient;
    }
  };

async function findACMCertificate(acm, domainName, managedByTag, environment) {
  let rootDomainName;
  const parts = domainName.split('.');
  if (parts.length > 2) {
    rootDomainName = parts.slice(1).join('.');
  }

  return await task(
    async progress => {
      const result = await acm.listCertificates({
        CertificateStatuses: ['ISSUED', 'PENDING_VALIDATION']
      });

      const certificates = result.CertificateSummaryList.filter(certificate => {
        if (certificate.DomainName === domainName) {
          return true;
        }
        if (rootDomainName) {
          if (certificate.DomainName === rootDomainName) {
            return true;
          }
          if (certificate.DomainName === '*.' + rootDomainName) {
            return true;
          }
        }
        return false;
      });

      let bestCertificates = [];

      for (let certificate of certificates) {
        certificate = await acm.describeCertificate({CertificateArn: certificate.CertificateArn});
        certificate = certificate.Certificate;

        if (certificate.Type !== 'AMAZON_ISSUED') {
          continue;
        }

        let bestName;
        for (const name of certificate.SubjectAlternativeNames) {
          if (name === domainName || (rootDomainName && name === '*.' + rootDomainName)) {
            if (!bestName || bestName.length < name.length) {
              bestName = name;
            }
          }
        }

        if (!bestName) {
          continue;
        }

        certificate._bestName = bestName;
        bestCertificates.push(certificate);
      }

      bestCertificates = sortBy(bestCertificates, certificate => -certificate._bestName.length);

      for (const certificate of bestCertificates) {
        if (certificate.Status === 'ISSUED') {
          progress.setOutro('ACM certificate found');
          return certificate;
        }
      }

      for (const certificate of bestCertificates) {
        if (certificate.Status === 'PENDING_VALIDATION') {
          const result = await acm.listTagsForCertificate({
            CertificateArn: certificate.CertificateArn
          });
          if (result.Tags.some(tag => isEqual(tag, managedByTag))) {
            progress.setOutro('Pending ACM certificate found');
            return certificate;
          }
        }
      }

      if (result.NextToken) {
        throw new Error('Wow, you have a lot of ACM certificates! Unfortunately, this tool can\'t list them all. Please post an issue on Resdir\'s GitHub if this is a problem for you.');
      }

      progress.setOutro('ACM certificate not found');
    },
    {
      intro: `Searching for the ACM certificate...`
    },
    environment
  );
}

async function waitUntilACMCertificateIsIssued(acm, certificateARN, environment) {
  await task(
    async () => {
      const sleepTime = 10000; // 10 seconds
      const maxSleepTime = 60 * 60 * 1000; // 1 hour
      let totalSleepTime = 0;
      do {
        await sleep(sleepTime);
        totalSleepTime += sleepTime;
        const {Certificate: certificate} = await acm.describeCertificate({
          CertificateArn: certificateARN
        });
        if (certificate.Status === 'ISSUED') {
          return;
        }
      } while (totalSleepTime <= maxSleepTime);
      throw new Error(`ACM certificate unapproved after ${totalSleepTime / 1000} seconds`);
    },
    {
      intro: `An email has been sent to the owner of the domain name, waiting for his approval...`,
      outro: `ACM certificate approved`
    },
    environment
  );
}
