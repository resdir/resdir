import {pick} from 'lodash';
import APIGatewayClient from 'aws-sdk/clients/apigateway';
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:api-gateway');

export class APIGateway {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {
      ...pick(config, keys),
      ...pick(config.apiGateway, keys),
      apiVersion: '2015-07-09',
      signatureVersion: 'v4'
    };
    this.client = new APIGatewayClient(config);
  }

  createBasePathMapping(params) {
    debug('createBasePathMapping(%o)', params);
    return this.client.createBasePathMapping(params).promise();
  }

  createDeployment(params) {
    debug('createDeployment(%o)', params);
    return this.client.createDeployment(params).promise();
  }

  createDomainName(params) {
    debug('createDomainName(%o)', params);
    return this.client.createDomainName(params).promise();
  }

  createRestApi(params) {
    debug('createRestApi(%o)', params);
    return this.client.createRestApi(params).promise();
  }

  createStage(params) {
    debug('createStage(%o)', params);
    return this.client.createStage(params).promise();
  }

  deleteBasePathMapping(params) {
    debug('deleteBasePathMapping(%o)', params);
    return this.client.deleteBasePathMapping(params).promise();
  }

  getBasePathMappings(params) {
    debug('getBasePathMappings(%o)', params);
    return this.client.getBasePathMappings(params).promise();
  }

  getDeployments(params) {
    debug('getDeployments(%o)', params);
    return this.client.getDeployments(params).promise();
  }

  getDomainName(params) {
    debug('getDomainName(%o)', params);
    return this.client.getDomainName(params).promise();
  }

  getResources(params) {
    debug('getResources(%o)', params);
    return this.client.getResources(params).promise();
  }

  getRestApi(params) {
    debug('getRestApi(%o)', params);
    return this.client.getRestApi(params).promise();
  }

  getRestApis(params) {
    debug('getRestApis(%o)', params);
    return this.client.getRestApis(params).promise();
  }

  getStage(params) {
    debug('getStage(%o)', params);
    return this.client.getStage(params).promise();
  }

  putMethod(params) {
    debug('putMethod(%o)', params);
    return this.client.putMethod(params).promise();
  }

  putMethodResponse(params) {
    debug('putMethodResponse(%o)', params);
    return this.client.putMethodResponse(params).promise();
  }

  putIntegration(params) {
    debug('putIntegration(%o)', params);
    return this.client.putIntegration(params).promise();
  }

  putIntegrationResponse(params) {
    debug('putIntegrationResponse(%o)', params);
    return this.client.putIntegrationResponse(params).promise();
  }

  updateDomainName(params) {
    debug('updateDomainName(%o)', params);
    return this.client.updateDomainName(params).promise();
  }
}

export default APIGateway;
