import {pick} from 'lodash';
import DynamoDBClient from 'aws-sdk/clients/dynamodb';
const {DocumentClient} = DynamoDBClient;
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:dynamodb');

export class DynamoDB {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {...pick(config, keys), ...pick(config.dynamoDB, keys), apiVersion: '2012-08-10'};
    this.client = new DocumentClient(config);
  }

  batchGet(params) {
    debug('batchGet(%o)', params);
    return this.client.batchGet(params).promise();
  }

  batchWrite(params) {
    debug('batchWrite(%o)', params);
    return this.client.batchWrite(params).promise();
  }

  createSet(list, options) {
    return this.client.createSet(list, options);
  }

  delete(params) {
    debug('delete(%o)', params);
    return this.client.delete(params).promise();
  }

  get(params) {
    debug('get(%o)', params);
    return this.client.get(params).promise();
  }

  put(params) {
    debug('put(%o)', params);
    return this.client.put(params).promise();
  }

  query(params) {
    debug('query(%o)', params);
    return this.client.query(params).promise();
  }

  scan(params) {
    debug('scan(%o)', params);
    return this.client.scan(params).promise();
  }

  update(params) {
    debug('update(%o)', params);
    return this.client.update(params).promise();
  }

  async forEach(params, fn) {
    if (!params) {
      throw new Error('\'params\' argument is missing');
    }

    if (!fn) {
      throw new Error('\'fn\' argument is missing');
    }

    debug('forEach(%o)', params);

    const data = await this.client.query(params).promise();

    if (data.LastEvaluatedKey) {
      // TODO: Implement query pagination
      // http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html#Query.Pagination
      throw new Error('UNIMPLEMENTED: DynamoDB query pagination');
    }

    for (const item of data.Items) {
      const result = await fn(item);
      if (result === false) {
        return false;
      }
    }
  }
}

export default DynamoDB;
