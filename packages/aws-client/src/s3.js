import {pick} from 'lodash';
import S3Client from 'aws-sdk/clients/s3';
import {formatString} from '@resdir/console';
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:s3');

export class S3 {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {...pick(config, keys), ...pick(config.s3, keys), apiVersion: '2006-03-01'};
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

export function getS3WebsiteDomainName(bucket, region = 'us-east-1') {
  return `${bucket}.s3-website-${region}.amazonaws.com`;
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
