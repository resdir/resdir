import {pick} from 'lodash';
import BatchClient from 'aws-sdk/clients/batch';
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:batch');

export class Batch {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {
      ...pick(config, keys),
      ...pick(config.batch, keys),
      apiVersion: '2016-08-10',
      signatureVersion: 'v4'
    };
    this.client = new BatchClient(config);
  }
}

const methods = [
  'cancelJob',
  'createComputeEnvironment',
  'createJobQueue',
  'deleteComputeEnvironment',
  'deleteJobQueue',
  'deregisterJobDefinition',
  'describeComputeEnvironments',
  'describeJobDefinitions',
  'describeJobQueues',
  'describeJobs',
  'listJobs',
  'registerJobDefinition',
  'submitJob',
  'terminateJob',
  'updateComputeEnvironment',
  'updateJobQueue'
];

for (const method of methods) {
  Batch.prototype[method] = function (params) {
    debug(`${method}(%o)`, params);
    return this.client[method](params).promise();
  };
}

export default Batch;
