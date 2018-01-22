import {pick} from 'lodash';
import Route53Client from 'aws-sdk/clients/route53';
import debugModule from 'debug';

const debug = debugModule('resdir:aws-client:route-53');

export class Route53 {
  constructor(config = {}) {
    const keys = ['accessKeyId', 'secretAccessKey', 'region'];
    config = {...pick(config, keys), ...pick(config.route53, keys), apiVersion: '2013-04-01'};
    this.client = new Route53Client(config);
  }

  changeResourceRecordSets(params) {
    debug('changeResourceRecordSets(%o)', params);
    return this.client.changeResourceRecordSets(params).promise();
  }

  getChange(params) {
    debug('getChange(%o)', params);
    return this.client.getChange(params).promise();
  }

  getHostedZone(params) {
    debug('getHostedZone(%o)', params);
    return this.client.getHostedZone(params).promise();
  }

  listHostedZones(params) {
    debug('listHostedZones(%o)', params);
    return this.client.listHostedZones(params).promise();
  }

  listHostedZonesByName(params) {
    debug('listHostedZonesByName(%o)', params);
    return this.client.listHostedZonesByName(params).promise();
  }

  listResourceRecordSets(params) {
    debug('listResourceRecordSets(%o)', params);
    return this.client.listResourceRecordSets(params).promise();
  }

  testDNSAnswer(params) {
    debug('listResourceRecordSets(%o)', params);
    return this.client.listResourceRecordSets(params).promise();
  }

  waitFor(state, params) {
    debug('waitFor(%o, %o)', state, params);
    return this.client.waitFor(state, params).promise();
  }
}

export default Route53;
