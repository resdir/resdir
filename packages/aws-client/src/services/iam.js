import IAMClient from 'aws-sdk/clients/iam';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:iam');

export class IAM {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'iam', apiVersion: '2010-05-08'});
    this.client = new IAMClient(awsConfig);
  }

  createRole(params) {
    debug('createRole(%o)', params);
    return this.client.createRole(params).promise();
  }

  getAccessKeyLastUsed(params) {
    debug('getAccessKeyLastUsed(%o)', params);
    return this.client.getAccessKeyLastUsed(params).promise();
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
