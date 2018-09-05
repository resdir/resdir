import SecretsManagerClient from 'aws-sdk/clients/secretsmanager';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:secrets-manager');

export class SecretsManager {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'secretsManager', apiVersion: '2017-10-17'});
    this.client = new SecretsManagerClient(awsConfig);
  }
}

const methods = [
  'cancelRotateSecret',
  'createSecret',
  'deleteResourcePolicy',
  'deleteSecret',
  'describeSecret',
  'getRandomPassword',
  'getResourcePolicy',
  'getSecretValue',
  'listSecrets',
  'listSecretVersionIds',
  'putResourcePolicy',
  'putSecretValue',
  'restoreSecret',
  'rotateSecret',
  'tagResource',
  'untagResource',
  'updateSecret',
  'updateSecretVersionStage'
];

for (const method of methods) {
  SecretsManager.prototype[method] = function (params) {
    debug(`${method}(%o)`, params);
    return this.client[method](params).promise();
  };
}

export default SecretsManager;
