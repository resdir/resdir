import SESClient from 'aws-sdk/clients/ses';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:ses');

export class SES {
  constructor(config = {}) {
    const awsConfig = buildAWSConfig(config, {service: 'ses', apiVersion: '2010-12-01'});
    this.client = new SESClient(awsConfig);
  }

  sendEmail(params) {
    debug('sendEmail(%o)', params);
    return this.client.sendEmail(params).promise();
  }
}

export default SES;
