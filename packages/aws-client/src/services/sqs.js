import SQSClient from 'aws-sdk/clients/sqs';
import debugModule from 'debug';

import buildAWSConfig from '../config';

const debug = debugModule('resdir:aws-client:sqs');

export class SQS {
  constructor(config) {
    const awsConfig = buildAWSConfig(config, {service: 'sqs', apiVersion: '2012-11-05'});
    this.client = new SQSClient(awsConfig);
  }
}

const methods = [
  'addPermission',
  'changeMessageVisibility',
  'changeMessageVisibilityBatch',
  'createQueue',
  'deleteMessage',
  'deleteMessageBatch',
  'deleteQueue',
  'getQueueAttributes',
  'getQueueUrl',
  'listDeadLetterSourceQueues',
  'listQueues',
  'listQueueTags',
  'purgeQueue',
  'receiveMessage',
  'removePermission',
  'sendMessage',
  'sendMessageBatch',
  'setQueueAttributes',
  'tagQueue',
  'untagQueue'
];

for (const method of methods) {
  SQS.prototype[method] = function (params) {
    debug(`${method}(%o)`, params);
    return this.client[method](params).promise();
  };
}

export default SQS;
