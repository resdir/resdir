import {pick} from 'lodash';
import S3Client from 'aws-sdk/clients/s3';
import {formatString} from '@resdir/console';
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:s3');

const S3_REGIONS = {
  'us-east-2': {websiteEndpoint: 's3-website.us-east-2.amazonaws.com'},
  'us-east-1': {websiteEndpoint: 's3-website-us-east-1.amazonaws.com'},
  'us-west-1': {websiteEndpoint: 's3-website-us-west-1.amazonaws.com'},
  'us-west-2': {websiteEndpoint: 's3-website-us-west-2.amazonaws.com'},
  'ca-central-1': {websiteEndpoint: 's3-website.ca-central-1.amazonaws.com'},
  'ap-south-1': {websiteEndpoint: 's3-website.ap-south-1.amazonaws.com'},
  'ap-northeast-2': {websiteEndpoint: 's3-website.ap-northeast-2.amazonaws.com'},
  'ap-southeast-1': {websiteEndpoint: 's3-website-ap-southeast-1.amazonaws.com'},
  'ap-southeast-2': {websiteEndpoint: 's3-website-ap-southeast-2.amazonaws.com'},
  'ap-northeast-1': {websiteEndpoint: 's3-website-ap-northeast-1.amazonaws.com'},
  'cn-northwest-1': {websiteEndpoint: 's3-website.cn-northwest-1.amazonaws.com.cn'},
  'eu-central-1': {websiteEndpoint: 's3-website.eu-central-1.amazonaws.com'},
  'eu-west-1': {websiteEndpoint: 's3-website-eu-west-1.amazonaws.com'},
  'eu-west-2': {websiteEndpoint: 's3-website.eu-west-2.amazonaws.com'},
  'eu-west-3': {websiteEndpoint: 's3-website.eu-west-3.amazonaws.com'},
  'sa-east-1': {websiteEndpoint: 's3-website-sa-east-1.amazonaws.com'}
};

export class S3 {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {
      ...pick(config, keys),
      ...pick(config.s3, keys),
      apiVersion: '2006-03-01',
      signatureVersion: 'v4'
    };
    this.client = new S3Client(config);
  }

  copyObject(params) {
    debug('copyObject(%o)', params);
    return this.client.copyObject(params).promise();
  }

  createBucket(params) {
    debug('createBucket(%o)', params);
    return this.client.createBucket(params).promise();
  }

  deleteObject(params) {
    debug('deleteObject(%o)', params);
    return this.client.deleteObject(params).promise();
  }

  deleteObjects(params) {
    debug('deleteObjects(%o)', params);
    return this.client.deleteObjects(params).promise();
  }

  getBucketLocation(params) {
    debug('getBucketLocation(%o)', params);
    return this.client.getBucketLocation(params).promise();
  }

  getBucketTagging(params) {
    debug('getBucketTagging(%o)', params);
    return this.client.getBucketTagging(params).promise();
  }

  getBucketWebsite(params) {
    debug('getBucketWebsite(%o)', params);
    return this.client.getBucketWebsite(params).promise();
  }

  getObject(params) {
    debug('getObject(%o)', params);
    return this.client.getObject(params).promise();
  }

  getSignedUrl(operation, params) {
    debug('getSignedUrl(%o, %o)', operation, params);
    return new Promise((resolve, reject) => {
      this.client.getSignedUrl(operation, params, (err, url) => {
        if (err) {
          reject(err);
        } else {
          resolve(url);
        }
      });
    });
  }

  headBucket(params) {
    debug('headBucket(%o)', params);
    return this.client.headBucket(params).promise();
  }

  listObjectsV2(params) {
    debug('listObjectsV2(%o)', params);
    return this.client.listObjectsV2(params).promise();
  }

  putBucketTagging(params) {
    debug('PutBucketTagging(%o)', params);
    return this.client.putBucketTagging(params).promise();
  }

  putBucketWebsite(params) {
    debug('putBucketWebsite(%o)', params);
    return this.client.putBucketWebsite(params).promise();
  }

  putObject(params) {
    debug('putObject(%o)', params);
    return this.client.putObject(params).promise();
  }

  waitFor(state, params) {
    debug('waitFor(%o, %o)', state, params);
    return this.client.waitFor(state, params).promise();
  }
}

export function getS3Endpoint(bucket) {
  return `${bucket}.s3.amazonaws.com`;
}

export function getS3WebsiteEndpoint(regionName = 'us-east-1') {
  const region = S3_REGIONS[regionName];
  if (!region) {
    throw new Error(`Sorry, AWS S3 region ${formatString(regionName)} is not supported yet`);
  }
  return region.websiteEndpoint;
}

export function getS3WebsiteDomainName(bucket, regionName) {
  return `${bucket}.${getS3WebsiteEndpoint(regionName)}`;
}

export function formatS3URL({bucket, key}) {
  return `https://${getS3Endpoint(bucket)}/${key}`;
}

export function parseS3URL(url) {
  const matches = url.match(/^https:\/\/(.+)\.s3\.amazonaws\.com\/(.+)$/i);
  if (!matches) {
    throw new Error(`Invalid S3 URL: ${formatString(url)}`);
  }
  return {bucket: matches[1], key: matches[2]};
}

export default S3;
