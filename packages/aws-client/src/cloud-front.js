import {pick} from 'lodash';
import CloudFrontClient from 'aws-sdk/clients/cloudfront';

const debug = require('debug')('resdir:aws-client:cloud-front');

export class CloudFront {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {...pick(config, keys), ...pick(config.cloudFront, keys), apiVersion: '2017-03-25'};
    this.client = new CloudFrontClient(config);
  }

  createDistribution(params) {
    debug('createDistribution(%o)', params);
    return this.client.createDistribution(params).promise();
  }

  createDistributionWithTags(params) {
    debug('createDistributionWithTags(%o)', params);
    return this.client.createDistributionWithTags(params).promise();
  }

  listDistributions(params) {
    debug('listDistributions(%o)', params);
    return this.client.listDistributions(params).promise();
  }

  listTagsForResource(params) {
    debug('listTagsForResource(%o)', params);
    return this.client.listTagsForResource(params).promise();
  }

  waitFor(state, params) {
    debug('waitFor(%o)', params);
    return this.client.waitFor(state, params).promise();
  }
}

export default CloudFront;
