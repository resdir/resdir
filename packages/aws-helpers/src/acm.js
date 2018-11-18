import assert from 'assert';
import {sortBy, isEqual} from 'lodash';
import {task, printText, formatString, formatDim} from '@resdir/console';
import {createClientError} from '@resdir/error';
import sleep from 'sleep-promise';

import {checkCNAME} from './external-dns';

export async function findACMCertificate(
  {domainName, cnameAdder, managerIdentifier, acm},
  environment
) {
  const certificate = await _findACMCertificate({domainName, managerIdentifier, acm}, environment);

  if (!certificate) {
    return undefined;
  }

  const arn = certificate.CertificateArn;

  if (certificate.Status === 'PENDING_VALIDATION') {
    await waitUntilACMCertificateValidationCNAMEIsAdded(
      {domainName, arn, cnameAdder, acm},
      environment
    );

    await waitUntilACMCertificateIsValidated({arn, acm}, environment);
  }

  return {arn};
}

async function _findACMCertificate({domainName, managerIdentifier, acm}, _environment) {
  let rootDomainName;
  const parts = domainName.split('.');
  if (parts.length > 2) {
    rootDomainName = parts.slice(1).join('.');
  }

  const result = await acm.listCertificates({
    CertificateStatuses: ['ISSUED', 'PENDING_VALIDATION'],
    Includes: {
      // We need this because it seems that 'RSA_4096' is excluded by default
      keyTypes: [
        'RSA_2048',
        'RSA_1024',
        'RSA_4096',
        'EC_prime256v1',
        'EC_secp384r1',
        'EC_secp521r1'
      ]
    },
    MaxItems: 1000
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
      return certificate;
    }
  }

  for (const certificate of bestCertificates) {
    if (certificate.Status === 'PENDING_VALIDATION') {
      const result = await acm.listTagsForCertificate({
        CertificateArn: certificate.CertificateArn
      });
      if (result.Tags.some(tag => isEqual(tag, {Key: 'managed-by', Value: managerIdentifier}))) {
        return certificate;
      }
    }
  }

  if (result.NextToken) {
    throw createClientError(
      `Whoa, you have a lot of ACM Certificates! Unfortunately, this tool can't list them all. Please post an issue on Resdir's GitHub if this is a problem for you.`
    );
  }
}

export async function requestACMCertificate(
  {domainName, cnameAdder, managerIdentifier, acm},
  environment
) {
  const {CertificateArn: arn} = await acm.requestCertificate({
    DomainName: domainName,
    ValidationMethod: 'DNS'
  });

  await acm.addTagsToCertificate({
    CertificateArn: arn,
    Tags: [{Key: 'managed-by', Value: managerIdentifier}]
  });

  await waitUntilACMCertificateValidationCNAMEIsAdded(
    {domainName, arn, cnameAdder, acm},
    environment
  );

  await waitUntilACMCertificateIsValidated({arn, acm}, environment);

  return {arn};
}

async function getACMCertificateValidationCNAME({arn, acm}, environment) {
  return await task(
    async () => {
      const sleepTime = 5 * 1000; // 5 seconds
      const maxSleepTime = 60 * 1000; // 1 minute
      let totalSleepTime = 0;
      do {
        await sleep(sleepTime);
        totalSleepTime += sleepTime;
        const {Certificate: certificate} = await acm.describeCertificate({
          CertificateArn: arn
        });
        const record = certificate.DomainValidationOptions[0].ResourceRecord;
        if (record) {
          assert(record.Type, 'CNAME');
          return {name: record.Name, value: record.Value};
        }
      } while (totalSleepTime <= maxSleepTime);
      throw createClientError(
        `Couldn't get ACM Certificate DNS Validation record after ${totalSleepTime / 1000} seconds`
      );
    },
    {
      intro: `Getting ACM Certificate DNS Validation record...`,
      outro: `ACM Certificate DNS Validation record found`
    },
    environment
  );
}

async function waitUntilACMCertificateValidationCNAMEIsAdded(
  {domainName, arn, cnameAdder, acm},
  environment
) {
  const validationCNAME = await getACMCertificateValidationCNAME({arn, acm}, environment);

  if (await checkCNAME(validationCNAME, environment)) {
    return;
  }

  if (cnameAdder && (await cnameAdder(validationCNAME, environment))) {
    return;
  }

  const formatedDomainName = formatString(domainName);

  printText(`
An SSL/TLS certificate has been requested for ${formatedDomainName}, but since this domain name doesn't seem to be managed by Route 53, you must validate the certificate manually by adding a CNAME record to the name servers.

Please create a DNS record as follows:

   ${formatDim('Name:')} ${formatString(validationCNAME.name)}
   ${formatDim('Type:')} ${formatString('CNAME')}
   ${formatDim('Value:')} ${formatString(validationCNAME.value)}
`);

  await task(
    async () => {
      const sleepTime = 15 * 1000; // 15 seconds
      const maxSleepTime = 30 * 60 * 1000; // 30 minutes
      let totalSleepTime = 0;
      do {
        await sleep(sleepTime);
        totalSleepTime += sleepTime;
        if (await checkCNAME(validationCNAME, environment)) {
          return;
        }
      } while (totalSleepTime <= maxSleepTime);
      throw createClientError(
        `The CNAME has not been created after ${totalSleepTime / 1000} seconds`
      );
    },
    {
      intro: `Waiting for you to manually create the CNAME...`,
      outro: `CNAME created`
    },
    environment
  );
}

async function waitUntilACMCertificateIsValidated({arn, acm}, environment) {
  await task(
    async () => {
      const sleepTime = 10000; // 10 seconds
      const maxSleepTime = 60 * 60 * 1000; // 1 hour
      let totalSleepTime = 0;
      do {
        await sleep(sleepTime);
        totalSleepTime += sleepTime;
        const {Certificate: certificate} = await acm.describeCertificate({
          CertificateArn: arn
        });
        if (certificate.Status === 'ISSUED') {
          return;
        }
      } while (totalSleepTime <= maxSleepTime);
      throw createClientError(
        `ACM Certificate has not been validated after ${totalSleepTime / 1000} seconds`
      );
    },
    {
      intro: `Waiting for ACM Certificate validation...`,
      outro: `ACM Certificate validated`
    },
    environment
  );
}
