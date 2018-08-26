import CloudFrontClient from 'aws-sdk/clients/cloudfront';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:cloud-front');

export class CloudFront {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'cloudFront', apiVersion: '2017-03-25'});
    this.client = new CloudFrontClient(awsConfig);
  }

  createDistribution(params) {
    debug('createDistribution(%o)', params);
    return this.client.createDistribution(params).promise();
  }

  createDistributionWithTags(params) {
    debug('createDistributionWithTags(%o)', params);
    return this.client.createDistributionWithTags(params).promise();
  }

  createInvalidation(params) {
    debug('createInvalidation(%o)', params);
    return this.client.createInvalidation(params).promise();
  }

  getDistribution(params) {
    debug('getDistribution(%o)', params);
    return this.client.getDistribution(params).promise();
  }

  getDistributionConfig(params) {
    debug('getDistributionConfig(%o)', params);
    return this.client.getDistributionConfig(params).promise();
  }

  getInvalidation(params) {
    debug('getInvalidation(%o)', params);
    return this.client.getInvalidation(params).promise();
  }

  listDistributions(params) {
    debug('listDistributions(%o)', params);
    return this.client.listDistributions(params).promise();
  }

  listTagsForResource(params) {
    debug('listTagsForResource(%o)', params);
    return this.client.listTagsForResource(params).promise();
  }

  updateDistribution(params) {
    debug('updateDistribution(%o)', params);
    return this.client.updateDistribution(params).promise();
  }

  waitFor(state, params) {
    debug('waitFor(%o, %o)', state, params);
    return this.client.waitFor(state, params).promise();
  }
}

export default CloudFront;
