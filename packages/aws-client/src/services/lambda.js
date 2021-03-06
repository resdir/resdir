import LambdaClient from 'aws-sdk/clients/lambda';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:lambda');

export class Lambda {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'lambda', apiVersion: '2015-03-31'});
    this.client = new LambdaClient(awsConfig);
  }

  addPermission(params) {
    debug('addPermission(%o)', params);
    return this.client.addPermission(params).promise();
  }

  createFunction(params) {
    debug('createFunction(%o)', params);
    return this.client.createFunction(params).promise();
  }

  deleteFunction(params) {
    debug('deleteFunction(%o)', params);
    return this.client.deleteFunction(params).promise();
  }

  deleteFunctionConcurrency(params) {
    debug('deleteFunctionConcurrency(%o)', params);
    return this.client.deleteFunctionConcurrency(params).promise();
  }

  getFunction(params) {
    debug('getFunction(%o)', params);
    return this.client.getFunction(params).promise();
  }

  getFunctionConfiguration(params) {
    debug('getFunctionConfiguration(%o)', params);
    return this.client.getFunctionConfiguration(params).promise();
  }

  invoke(params) {
    debug('invoke(%o)', params);
    return this.client.invoke(params).promise();
  }

  listTags(params) {
    debug('listTags(%o)', params);
    return this.client.listTags(params).promise();
  }

  putFunctionConcurrency(params) {
    debug('putFunctionConcurrency(%o)', params);
    return this.client.putFunctionConcurrency(params).promise();
  }

  removePermission(params) {
    debug('removePermission(%o)', params);
    return this.client.removePermission(params).promise();
  }

  tagResource(params) {
    debug('tagResource(%o)', params);
    return this.client.tagResource(params).promise();
  }

  untagResource(params) {
    debug('untagResource(%o)', params);
    return this.client.untagResource(params).promise();
  }

  updateFunctionCode(params) {
    debug('updateFunctionCode(%o)', params);
    return this.client.updateFunctionCode(params).promise();
  }

  updateFunctionConfiguration(params) {
    debug('updateFunctionConfiguration(%o)', params);
    return this.client.updateFunctionConfiguration(params).promise();
  }
}

export default Lambda;
