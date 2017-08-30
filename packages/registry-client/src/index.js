import {resolve} from 'path';
import {existsSync} from 'fs';
// import {homedir} from 'os';
// import {outputFileSync, emptyDir} from 'fs-extra';
import S3 from 'aws-sdk/clients/s3';
import hasha from 'hasha';
import s3urls from '@mapbox/s3urls';
import tempy from 'tempy';
import isDirectory from 'is-directory';
import readDirectory from 'recursive-readdir';
import {formatPath, formatCode} from '@resdir/console';
// import {load, save} from '@resdir/file-manager';
import {validateResourceSpecifier} from '@resdir/resource-specifier';
import generateSecret from '@resdir/secret-generator';
import {getJSON, postJSON, fetch} from '@resdir/http-client';
import {zip, unzip} from '@resdir/archive-manager';

const debug = require('debug')('resdir:registry:client');

const RESDIR_REGISTRY_LOCAL_SERVER_URL = 'http://localhost:3000/registry';

export class RegistryClient {
  constructor({awsRegion, awsS3BucketName, awsS3ResourceUploadsPrefix}) {
    this.awsRegion = awsRegion;
    this.awsS3BucketName = awsS3BucketName;
    this.awsS3ResourceUploadsPrefix = awsS3ResourceUploadsPrefix;
  }

  async fetch(specifier, options) {
    const result = await this._fetch(specifier, options);
    debug('fetch(%o, %o) => %o', specifier, options, result);
    return result;
  }

  async _fetch(specifier, {cachedVersion} = {}) {
    validateResourceSpecifier(specifier);

    let url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/resources/${specifier}`;
    if (cachedVersion) {
      url += `?cachedVersion=${cachedVersion}`;
    }
    const {unchanged, definition, filesURL} = await getJSON(url);

    if (unchanged) {
      return {unchanged};
    }

    const directory = tempy.directory();

    // TODO: Instead of a buffer, use a stream to download and unzip files
    const files = await fetch(filesURL);
    await unzip(directory, files);

    return {definition, directory};
  }

  async publish(definition, directory) {
    await this._publish(definition, directory);
    debug('publish(%o, %o)', definition, directory);
  }

  async _publish(definition, directory) {
    const name = definition['@name'];
    if (!name) {
      throw new Error(`Can't publish a resource without a ${formatCode('@name')} property`);
    }

    if (!definition['@version']) {
      throw new Error(`Can't publish a resource without a ${formatCode('@version')} property`);
    }

    let files = await this._getFiles(definition, directory);

    // TODO: Instead of a buffer, use a stream to zip and upload files
    files = await zip(directory, files);

    const s3 = new S3({region: this.awsRegion, apiVersion: '2006-03-01'});
    const md5 = await hasha(files, {algorithm: 'md5', encoding: 'base64'});
    const key = this.awsS3ResourceUploadsPrefix + generateSecret() + '.zip';
    await s3
      .putObject({
        Bucket: this.awsS3BucketName,
        Key: key,
        Body: files,
        ContentMD5: md5
      })
      .promise();

    const temporaryFilesURL = s3urls.toUrl(this.awsS3BucketName, key)['bucket-in-host'];

    const url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/resources`;
    const body = {definition, temporaryFilesURL};
    await postJSON(url, {body});
  }

  async _getFiles(definition, directory) {
    const files = [];

    const filesProperty = definition['@files'] || [];
    for (const file of filesProperty) {
      const resolvedFile = resolve(directory, file);

      if (!existsSync(resolvedFile)) {
        throw new Error(
          `File ${formatPath(file)} specified in ${formatCode('@files')} property doesn't exist`
        );
      }

      if (isDirectory.sync(resolvedFile)) {
        const newFiles = await readDirectory(resolvedFile);
        files.push(...newFiles);
      } else {
        files.push(resolvedFile);
      }
    }

    return files;
  }
}

export default RegistryClient;
