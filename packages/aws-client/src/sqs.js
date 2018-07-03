import {pick} from 'lodash';
import SQSClient from 'aws-sdk/clients/sqs';
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:sqs');

export class SQS {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {
      ...pick(config, keys),
      ...pick(config.sqs, keys),
      apiVersion: '2012-11-05',
      signatureVersion: 'v4'
    };
    this.client = new SQSClient(config);
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
