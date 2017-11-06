import {pick} from 'lodash';
import SESClient from 'aws-sdk/clients/ses';

const debug = require('debug')('resdir:aws-client:ses');

export class SES {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {...pick(config, keys), ...pick(config.ses, keys), apiVersion: '2010-12-01'};
    this.client = new SESClient(config);
  }

  sendEmail(params) {
    debug('sendEmail(%o)', params);
    return this.client.sendEmail(params).promise();
  }
}

export default SES;