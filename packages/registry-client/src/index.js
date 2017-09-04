import {join, resolve, dirname} from 'path';
import {existsSync} from 'fs';
import {homedir} from 'os';
import {upperFirst} from 'lodash';
import {ensureDirSync} from 'fs-extra';
import S3 from 'aws-sdk/clients/s3';
import hasha from 'hasha';
import s3urls from '@mapbox/s3urls';
import tempy from 'tempy';
import isDirectory from 'is-directory';
import readDirectory from 'recursive-readdir';
import {formatString, formatPath, formatCode, prompt, task} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {validateResourceSpecifier} from '@resdir/resource-specifier';
import generateSecret from '@resdir/secret-generator';
import {getJSON, postJSON, fetch} from '@resdir/http-client';
import {zip, unzip} from '@resdir/archive-manager';

const debug = require('debug')('resdir:registry:client');

const RESDIR_DIRECTORY = join(homedir(), '.resdir');
const USER_FILE = join(RESDIR_DIRECTORY, 'user.json');
const CACHE_FILE = join(RESDIR_DIRECTORY, 'caches', 'registry-client', 'data.json');

const RESDIR_REGISTRY_LOCAL_SERVER_URL = 'http://localhost:3000/registry';

export class RegistryClient {
  constructor({awsRegion, awsS3BucketName, awsS3ResourceUploadsPrefix, clientId}) {
    this.awsRegion = awsRegion;
    this.awsS3BucketName = awsS3BucketName;
    this.awsS3ResourceUploadsPrefix = awsS3ResourceUploadsPrefix;
    this.clientId = clientId;
  }

  async signUp(email) {
    return await this._signUpOrSignIn('SIGN_UP', email);
  }

  async signIn(email) {
    return await this._signUpOrSignIn('SIGN_IN', email);
  }

  async _signUpOrSignIn(action, email) {
    if (this._hasSignedInUser()) {
      throw new Error('A user is already signed in');
    }

    while (!email) {
      email = await prompt('Enter your email address:');
    }

    const messagePart = action === 'SIGN_UP' ? 'sign up' : 'sign in';
    const urlPart = action === 'SIGN_UP' ? 'sign-up' : 'sign-in';

    await task(
      async () => {
        const url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/user/start-${urlPart}`;
        await postJSON(url, {email, clientId: this.clientId});
      },
      {
        intro: `Sending verification token to ${formatString(email)}...`,
        outro: `Verification token sent to ${formatString(email)}`
      }
    );

    let completed;
    while (!completed) {
      const verificationToken = await prompt(
        'Check your mailbox and copy/paste the received token:'
      );
      if (!verificationToken) {
        continue;
      }
      await task(
        async () => {
          const url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/user/complete-${urlPart}`;
          const {userId, refreshToken} = await postJSON(url, {verificationToken});
          this._saveUserId(userId);
          this._saveRefreshToken(refreshToken);
          completed = true;
        },
        {intro: `Completing ${messagePart}...`, outro: `${upperFirst(messagePart)} completed`}
      );
    }

    if (action === 'SIGN_UP') {
      await this.createUserNamespace();
    }
  }

  async signOut() {
    this._ensureSignedInUser();

    await task(
      async () => {
        const url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/user/sign-out`;
        const refreshToken = this._loadRefreshToken();
        await postJSON(url, {refreshToken});
        this._saveUserId(undefined);
        this._saveRefreshToken(undefined);
        this._saveAccessToken(undefined);
      },
      {intro: `Signing out...`, outro: `Signed out`}
    );
  }

  async createUserNamespace(namespace) {
    const userId = this._ensureSignedInUser();

    while (!namespace) {
      namespace = await prompt('Choose a name for your personal namespace:');
    }

    await task(
      async () => {
        const url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/users/${userId}/namespace`;
        await this._userRequest(authorization => postJSON(url, {namespace}, {authorization}));
      },
      {
        intro: `Creating namespace ${formatString(namespace)}...`,
        outro: `Namespace ${formatString(namespace)} created`
      }
    );
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

    const {unchanged, definition, filesURL} = await this._userRequest(authorization =>
      getJSON(url, {authorization})
    );

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
    this._ensureSignedInUser();

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
    await this._userRequest(authorization =>
      postJSON(url, {definition, temporaryFilesURL}, {authorization})
    );
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

  // === User ===

  _ensureSignedInUser({throwIfNoSignedInUser = true} = {}) {
    const userId = this._loadUserId();
    if (!userId) {
      if (throwIfNoSignedInUser) {
        throw new Error('No user is signed in');
      }
      return undefined;
    }
    return userId;
  }

  _hasSignedInUser() {
    return Boolean(this._loadUserId());
  }

  _loadUserId() {
    if (!this._userId) {
      this._userId = this._loadUserData().id;
    }
    return this._userId;
  }

  _saveUserId(id) {
    this._userId = id;
    this._updateUserData({id});
  }

  _loadUserData() {
    return load(USER_FILE, {throwIfNotFound: false}) || {};
  }

  _saveUserData(data) {
    ensureDirSync(dirname(USER_FILE));
    save(USER_FILE, data);
  }

  _updateUserData(data) {
    const userData = this._loadUserData();
    Object.assign(userData, data);
    this._saveUserData(userData);
  }

  // === Authentication ===

  async _userRequest(fn) {
    let accessToken = await this._loadAccessToken();
    const request = async () => {
      const authorization = accessToken && `Bearer ${accessToken}`;
      return await fn(authorization);
    };
    try {
      return await request();
    } catch (err) {
      if (err.httpStatus === 401) {
        accessToken = await this._refreshAccessToken();
        return await request();
      }
      throw err;
    }
  }

  _loadRefreshToken() {
    if (!this._refreshToken) {
      this._refreshToken = this._loadUserData().refreshToken;
    }
    return this._refreshToken;
  }

  _saveRefreshToken(refreshToken) {
    this._refreshToken = refreshToken;
    this._updateUserData({refreshToken});
  }

  async _loadAccessToken() {
    if (!this._accessToken) {
      const cache = this._loadCache();
      this._accessToken = cache.accessToken;
      if (this._accessToken) {
        this._accessToken.expiresOn = new Date(this._accessToken.expiresOn);
      }
    }
    if (!this._accessToken) {
      await this._refreshAccessToken();
    }
    if (!this._accessToken) {
      return undefined;
    }
    if (Date.now() > this._accessToken.expiresOn - 3 * 60 * 1000) {
      // Refresh access token 3 minutes before expiration
      await this._refreshAccessToken();
    }
    return this._accessToken.value;
  }

  async _refreshAccessToken() {
    debug('_refreshAccessToken()');
    let accessToken;
    try {
      const refreshToken = this._loadRefreshToken();
      if (!refreshToken) {
        return;
      }
      const url = `${RESDIR_REGISTRY_LOCAL_SERVER_URL}/user/access-tokens`;
      const {accessToken: {value, expiresIn}} = await postJSON(url, {refreshToken});
      accessToken = {value, expiresOn: new Date(Date.now() + expiresIn)};
      return value;
    } finally {
      this._saveAccessToken(accessToken);
    }
  }

  _saveAccessToken(accessToken) {
    this._accessToken = accessToken;
    this._updateCache({accessToken});
  }

  // === Cache ===

  _loadCache() {
    return load(CACHE_FILE, {throwIfNotFound: false}) || {};
  }

  _saveCache(data) {
    ensureDirSync(dirname(CACHE_FILE));
    save(CACHE_FILE, data);
  }

  _updateCache(data) {
    const cache = this._loadCache();
    Object.assign(cache, data);
    this._saveCache(cache);
  }
}

export default RegistryClient;
