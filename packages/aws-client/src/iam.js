import {pick} from 'lodash';
import IAMClient from 'aws-sdk/clients/iam';

const debug = require('debug')('resdir:aws-client:iam');

export class IAM {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {...pick(config, keys), ...pick(config.iam, keys), apiVersion: '2010-05-08'};
    this.client = new IAMClient(config);
  }

  createRole(params) {
    debug('createRole(%o)', params);
    return this.client.createRole(params).promise();
  }

  getRole(params) {
    debug('getRole(%o)', params);
    return this.client.getRole(params).promise();
  }

  putRolePolicy(params) {
    debug('putRolePolicy(%o)', params);
    return this.client.putRolePolicy(params).promise();
  }
}

export default IAM;
