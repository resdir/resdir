import BatchClient from 'aws-sdk/clients/batch';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:batch');

export class Batch {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'batch', apiVersion: '2016-08-10'});
    this.client = new BatchClient(awsConfig);
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
