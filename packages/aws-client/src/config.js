import {pick} from 'lodash';
import AWS from 'aws-sdk';

export function buildAWSConfig(config = {}, {service, apiVersion, signatureVersion = 'v4'}) {
  let credentials;
  const {profile} = config;
  if (profile) {
    credentials = new AWS.SharedIniFileCredentials({profile});
    credentials = pick(credentials, ['accessKeyId', 'secretAccessKey']);
  }

  const awsConfig = {
    ...credentials,
    ...pick(config, ['accessKeyId', 'secretAccessKey', 'region']),
    ...pick(config[service], ['accessKeyId', 'secretAccessKey', 'region']),
    apiVersion,
    signatureVersion
  };

  return awsConfig;
}

export default buildAWSConfig;
