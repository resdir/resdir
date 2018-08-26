import ACMClient from 'aws-sdk/clients/acm';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:acm');

export class ACM {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'acm', apiVersion: '2015-12-08'});
    this.client = new ACMClient(awsConfig);
  }

  addTagsToCertificate(params) {
    debug('addTagsToCertificate(%o)', params);
    return this.client.addTagsToCertificate(params).promise();
  }

  describeCertificate(params) {
    debug('describeCertificate(%o)', params);
    return this.client.describeCertificate(params).promise();
  }

  listCertificates(params) {
    debug('listCertificates(%o)', params);
    return this.client.listCertificates(params).promise();
  }

  listTagsForCertificate(params) {
    debug('listTagsForCertificate(%o)', params);
    return this.client.listTagsForCertificate(params).promise();
  }

  requestCertificate(params) {
    debug('requestCertificate(%o)', params);
    return this.client.requestCertificate(params).promise();
  }

  resendValidationEmail(params) {
    debug('resendValidationEmail(%o)', params);
    return this.client.resendValidationEmail(params).promise();
  }
}

export default ACM;
