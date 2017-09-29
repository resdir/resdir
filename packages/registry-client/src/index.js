import {join, resolve, dirname} from 'path';
import {existsSync} from 'fs';
import {upperFirst} from 'lodash';
import {ensureDirSync} from 'fs-extra';
import S3 from 'aws-sdk/clients/s3';
import hasha from 'hasha';
import s3urls from '@mapbox/s3urls';
import tempy from 'tempy';
import isDirectory from 'is-directory';
import readDirectory from 'recursive-readdir';
import opn from 'opn';
import {
  formatString,
  formatPath,
  formatCode,
  formatURL,
  print,
  emptyLine,
  printSuccess,
  printText,
  prompt,
  confirm,
  task
} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {validateResourceSpecifier} from '@resdir/resource-specifier';
import generateSecret from '@resdir/secret-generator';
import {getJSON, postJSON, deleteJSON, fetch} from '@resdir/http-client';
import {zip, unzip} from '@resdir/archive-manager';

const debug = require('debug')('resdir:registry:client');

export class RegistryClient {
  constructor({
    registryURL,
    runDirectory,
    clientId,
    awsRegion,
    awsS3BucketName,
    awsS3ResourceUploadsPrefix
  }) {
    if (!registryURL) {
      throw new Error('\'registryURL\' argument is missing');
    }
    if (!runDirectory) {
      throw new Error('\'runDirectory\' argument is missing');
    }
    if (!clientId) {
      throw new Error('\'clientId\' argument is missing');
    }
    if (!(awsRegion && awsS3BucketName && awsS3ResourceUploadsPrefix)) {
      throw new Error('AWS configuration is missing or incomplete');
    }
    this.registryURL = registryURL;
    this.userFile = join(runDirectory, 'user.json');
    this.cacheFile = join(runDirectory, 'caches', 'registry-client', 'data.json');
    this.clientId = clientId;
    this.awsRegion = awsRegion;
    this.awsS3BucketName = awsS3BucketName;
    this.awsS3ResourceUploadsPrefix = awsS3ResourceUploadsPrefix;
  }

  // === Users ===

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
      emptyLine();
      email = await prompt('Enter your email address:');
      emptyLine();
    }

    const messagePart = action === 'SIGN_UP' ? 'sign up' : 'sign in';
    const urlPart = action === 'SIGN_UP' ? 'sign-up' : 'sign-in';

    await task(
      async () => {
        const url = `${this.registryURL}/user/start-${urlPart}`;
        await postJSON(url, {email, clientId: this.clientId});
      },
      {
        intro: `Sending verification token to ${formatString(email)}...`,
        outro: `Verification token sent to ${formatString(email)}`
      }
    );

    let completed;
    while (!completed) {
      emptyLine();
      const verificationToken = await prompt(
        'Check your mailbox and copy/paste the received token:',
        {type: 'PASSWORD'}
      );
      emptyLine();

      if (!verificationToken) {
        continue;
      }

      await task(
        async () => {
          const url = `${this.registryURL}/user/complete-${urlPart}`;
          const {body: {userId, refreshToken}} = await postJSON(url, {verificationToken});
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
        const url = `${this.registryURL}/user/sign-out`;
        const refreshToken = this._loadRefreshToken();
        await postJSON(url, {refreshToken});
      },
      {intro: `Signing out...`, outro: `Signed out`}
    );

    this._signOut();
  }

  _signOut() {
    this._saveUserId(undefined);
    this._saveRefreshToken(undefined);
    this._saveAccessToken(undefined);
  }

  async showUser() {
    console.dir(await this.getUser(), {depth: null, colors: true});
  }

  async deleteUser() {
    const user = await this.getUser();

    emptyLine();
    const okay = await confirm(
      `Are you sure you want to delete your account (${formatString(user.email)})?`
    );
    emptyLine();

    if (!okay) {
      return;
    }

    emptyLine();
    const reallyOkay = await confirm(`Really?`);
    emptyLine();

    if (!reallyOkay) {
      return;
    }

    await task(
      async () => {
        const url = `${this.registryURL}/users/${user.id}`;
        await this._userRequest(authorization => deleteJSON(url, {authorization}));
      },
      {
        intro: `Deleting ${formatString(user.email)} account...`,
        outro: `${formatString(user.email)} account deleted`
      }
    );

    this._signOut();
  }

  async getUser() {
    if (!this._user) {
      const userId = this._ensureSignedInUser();

      const {body: user} = await task(
        async () => {
          const url = `${this.registryURL}/users/${userId}`;
          return await this._userRequest(authorization => getJSON(url, {authorization}));
        },
        {intro: `Fetching user...`, outro: `User fetched`}
      );

      this._user = user;
    }

    return this._user;
  }

  // === Namespaces ===

  async createUserNamespace(namespace) {
    const user = await this.getUser();

    if (user.namespace) {
      throw new Error(`You already have a namespace (${formatString(user.namespace)})`);
    }

    while (!namespace) {
      emptyLine();
      namespace = await prompt('Choose a name for your personal namespace:');
      emptyLine();
    }

    const formattedNamespace = formatString(namespace);

    const result = await this.checkNamespaceAvailability(namespace);

    let {available, reason} = result;

    if (!available && reason === 'INVALID') {
      throw new Error(
        `Sorry, this namespace is invalid. A namespace must be composed of lowercase letters, numbers and dashes ("-").`
      );
    }

    if (!available && reason === 'TOO_SHORT') {
      throw new Error(`Sorry, a namespace must have a minimum of 2 characters`);
    }

    if (!available && reason === 'ALREADY_TAKEN') {
      throw new Error(`Sorry, this namespace is alrady taken`);
    }

    if (!available && reason === 'RESERVED') {
      throw new Error(`Sorry, this namespace is reserved`);
    }

    if (!available && reason === 'IMPORTANT_GITHUB_USER') {
      const message = `There is a popular GitHub user named ${formattedNamespace}. Although Resdir is not related to GitHub, most popular GitHub usernames are reserved so that their owner can get them in the future.`;

      if (result.userHasGitHubAccountConnection) {
        throw new Error(message);
      }

      emptyLine();
      printText(message);
      emptyLine();
      printText(
        `If the GitHub account named ${formattedNamespace} is yours and you care about this name, you can get it by connecting your Resdir account to your GitHub account. Don't worry, Resdir will only have access to your GitHub public information.`
      );
      emptyLine();
      const okay = await confirm(`Do you want to continue?`, {default: true});
      emptyLine();

      if (!okay) {
        return;
      }

      await this.connectGitHubAccount();

      ({available, reason} = await this.checkNamespaceAvailability(namespace));

      if (!available) {
        await this.disconnectGitHubAccount();
      }

      if (!available && reason === 'IMPORTANT_GITHUB_USER') {
        throw new Error(
          `The username of the GitHub account you connected to is not ${formattedNamespace}`
        );
      }
    }

    if (!available) {
      throw new Error(`The namespace ${formattedNamespace} is not available`);
    }

    await task(
      async () => {
        const url = `${this.registryURL}/users/${user.id}/namespace`;
        await this._userRequest(authorization => postJSON(url, {namespace}, {authorization}));
      },
      {
        intro: `Creating namespace ${formatString(namespace)}...`,
        outro: `Namespace ${formatString(namespace)} created`
      }
    );
  }

  async removeUserNamespace() {
    const user = await this.getUser();
    if (!user.namespace) {
      throw new Error(`You don't have a namespace`);
    }

    await task(
      async () => {
        const url = `${this.registryURL}/users/${user.id}/namespace`;
        await this._userRequest(authorization => deleteJSON(url, {authorization}));
      },
      {
        intro: `Removing namespace ${formatString(user.namespace)}...`,
        outro: `Namespace ${formatString(user.namespace)} removed`
      }
    );
  }

  async checkNamespaceAvailability(namespace) {
    const {body: result} = await task(
      async () => {
        const url = `${this.registryURL}/namespaces/check-availability`;
        return await this._userRequest(authorization =>
          postJSON(url, {namespace}, {authorization})
        );
      },
      {
        intro: `Checking namespace...`,
        outro: `Namespace checked`
      }
    );
    return result;
  }

  // === GitHub account connections ===

  async connectGitHubAccount() {
    this._ensureSignedInUser();

    const {body: {gitHubAccountConnectionURL}} = await task(
      async () => {
        const url = `${this.registryURL}/user/start-connect-github-account`;
        return await this._userRequest(authorization => postJSON(url, undefined, {authorization}));
      },
      {
        intro: `Fetching connection URL...`,
        outro: `Connection URL fetched`
      }
    );

    printSuccess(`GitHub connection page opened in your browser`);
    emptyLine();
    printText(
      `If the GitHub connection page doesn't open automatically, please copy/paste the following URL in your browser:`
    );
    emptyLine();
    print(formatURL(gitHubAccountConnectionURL));

    opn(gitHubAccountConnectionURL, {wait: false});

    emptyLine();
    const okay = await confirm(`Have you completed the GitHub connection?`, {default: true});
    emptyLine();

    if (!okay) {
      throw new Error('GitHub account connection aborted');
    }

    await this.ensureGitHubConnection();
  }

  async disconnectGitHubAccount() {
    this._ensureSignedInUser();

    await task(
      async () => {
        const url = `${this.registryURL}/user/disconnect-github-account`;
        await this._userRequest(authorization => postJSON(url, undefined, {authorization}));
      },
      {
        intro: `Diconnecting GitHub account...`,
        outro: `GitHub account diconnected`
      }
    );
  }

  async ensureGitHubConnection() {
    this._ensureSignedInUser();

    return await task(
      async () => {
        const url = `${this.registryURL}/user/check-github-connection`;
        const {body: {connected}} = await this._userRequest(authorization =>
          postJSON(url, undefined, {authorization})
        );
        if (!connected) {
          throw new Error('GitHub account connection failed');
        }
      },
      {
        intro: `Checking GitHub account connection...`,
        outro: `GitHub account connection checked`
      }
    );
  }

  // === Resources ===

  async fetchResource(specifier, options) {
    const result = await this._fetchResource(specifier, options);
    debug('fetchResource(%o, %o) => %o', specifier, options, result);
    return result;
  }

  async _fetchResource(specifier, {cachedVersion} = {}) {
    validateResourceSpecifier(specifier);

    let url = `${this.registryURL}/resources/${specifier}`;
    if (cachedVersion) {
      url += `?cachedVersion=${cachedVersion}`;
    }

    const {body: {unchanged, definition, filesURL}} = await this._userRequest(authorization =>
      getJSON(url, {authorization})
    );

    if (unchanged) {
      return {unchanged};
    }

    const directory = tempy.directory();

    // TODO: Instead of a buffer, use a stream to download and unzip files
    const {body: files} = await fetch(filesURL, {expectedStatus: 200});
    await unzip(directory, files);

    return {definition, directory};
  }

  async publishResource(definition, directory) {
    await this._publishResource(definition, directory);
    debug('publishResource(%o, %o)', definition, directory);
  }

  async _publishResource(definition, directory) {
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

    const url = `${this.registryURL}/resources`;
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

  // === User session ===

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
    return load(this.userFile, {throwIfNotFound: false}) || {};
  }

  _saveUserData(data) {
    ensureDirSync(dirname(this.userFile));
    save(this.userFile, data);
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
      if (err.status === 401) {
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
      const url = `${this.registryURL}/user/access-tokens`;
      const {body: {accessToken: {value, expiresIn}}} = await postJSON(url, {refreshToken});
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
    return load(this.cacheFile, {throwIfNotFound: false}) || {};
  }

  _saveCache(data) {
    ensureDirSync(dirname(this.cacheFile));
    save(this.cacheFile, data);
  }

  _updateCache(data) {
    const cache = this._loadCache();
    Object.assign(cache, data);
    this._saveCache(cache);
  }
}

export default RegistryClient;
