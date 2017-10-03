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
  formatExample,
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
import {SERVICE_NAME, SUPPORT_EMAIL_ADDRESS} from '@resdir/information';

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

  async getUserByNamespace(namespace) {
    if (!namespace) {
      throw new Error('\'namespace\' argument is missing');
    }

    const {body: [user]} = await task(
      async () => {
        const url = `${this.registryURL}/users?namespace=${encodeURIComponent(namespace)}`;
        return await this._userRequest(authorization => getJSON(url, {authorization}));
      },
      {
        intro: `Fetching ${formatString(namespace)} user...`,
        outro: `${formatString(namespace)} user fetched`
      }
    );

    return user;
  }

  // === Organizations ===

  async createOrganization(namespace) {
    this._ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Organization namespace: ${formatExample('twitter')}`);
      emptyLine();
    }

    await this.checkNamespaceAvailability(namespace, 'ORGANIZATION', {
      parentAction: 'CREATE_ORGANIZATION'
    });

    await task(
      async () => {
        const url = `${this.registryURL}/organizations`;
        await this._userRequest(authorization => postJSON(url, {namespace}, {authorization}));
      },
      {
        intro: `Creating organization...`,
        outro: `Organization created`
      }
    );
  }

  async deleteOrganization(namespace) {
    this._ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Organization namespace:`);
      emptyLine();
    }

    const organization = await this.getOrganizationByNamespace(namespace);

    emptyLine();
    const okay = await confirm(
      `Are you sure you want to delete ${formatString(namespace)} organization?`
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
        const url = `${this.registryURL}/organizations/${organization.id}`;
        await this._userRequest(authorization => deleteJSON(url, {authorization}));
      },
      {
        intro: `Deleting ${formatString(namespace)} organization...`,
        outro: `${formatString(namespace)} organization deleted`
      }
    );
  }

  async getOrganizationByNamespace(namespace) {
    if (!namespace) {
      throw new Error('\'namespace\' argument is missing');
    }

    const {body: [organization]} = await task(
      async () => {
        const url = `${this.registryURL}/organizations?namespace=${encodeURIComponent(namespace)}`;
        return await this._userRequest(authorization => getJSON(url, {authorization}));
      },
      {
        intro: `Fetching ${formatString(namespace)} organization...`,
        outro: `${formatString(namespace)} organization fetched`
      }
    );

    return organization;
  }

  async listUserOrganizations() {
    const userId = this._ensureSignedInUser();

    const {body: organizations} = await task(
      async () => {
        const url = `${this.registryURL}/users/${userId}/organizations`;
        return await this._userRequest(authorization => getJSON(url, {authorization}));
      },
      {
        intro: `Fetching organizations...`,
        outro: `Organizations fetched`
      }
    );

    if (organizations.length === 0) {
      emptyLine();
      print('You don\'t belong to any organization.');
      return;
    }

    emptyLine();
    print(`You belong to ${organizations.length} organizations:`);
    for (const organization of organizations) {
      let name = organization.name;
      if (name) {
        name += ` (${formatString(organization.namespace)})`;
      } else {
        name = formatString(organization.namespace);
      }
      print(`- ${name}`);
    }
  }

  async addOrganizationMember(organizationNamespace, userNamespace) {
    const organization = await this.getOrganizationByNamespace(organizationNamespace);
    const user = await this.getUserByNamespace(userNamespace);

    await task(
      async () => {
        const url = `${this.registryURL}/organizations/${organization.id}/members`;
        await this._userRequest(authorization =>
          postJSON(url, {memberId: user.id}, {authorization})
        );
      },
      {
        intro: `Adding member...`,
        outro: `Member added`
      }
    );
  }

  async removeOrganizationMember(organizationNamespace, userNamespace) {
    const organization = await this.getOrganizationByNamespace(organizationNamespace);
    const user = await this.getUserByNamespace(userNamespace);

    await task(
      async () => {
        const url = `${this.registryURL}/organizations/${organization.id}/members/${user.id}`;
        await this._userRequest(authorization => deleteJSON(url, {authorization}));
      },
      {
        intro: `Removing member...`,
        outro: `Member removed`
      }
    );
  }

  // === Namespaces ===

  async createUserNamespace(namespace) {
    const user = await this.getUser();

    if (user.namespace) {
      throw new Error(`You already have a namespace (${formatString(user.namespace)})`);
    }

    while (!namespace) {
      emptyLine();
      namespace = await prompt(
        `Choose a name for your personal namespace: ${formatExample('ltorvalds')}`
      );
      emptyLine();
    }

    await this.checkNamespaceAvailability(namespace, 'USER', {
      parentAction: 'CREATE_USER_NAMESPACE'
    });

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

  /* eslint-disable complexity */
  async checkNamespaceAvailability(
    namespace,
    type,
    {parentAction, throwIfUnavailable = true} = {}
  ) {
    if (!(type === 'USER' || type === 'ORGANIZATION')) {
      throw new Error('Invalid \'type\'');
    }

    const formattedNamespace = formatString(namespace);

    let {body: result} = await task(
      async () => {
        const url = `${this.registryURL}/namespaces/check-availability`;
        return await this._userRequest(authorization =>
          postJSON(url, {namespace, type}, {authorization})
        );
      },
      {
        intro: `Checking namespace...`,
        outro: `Namespace checked`
      }
    );

    let {available, reason} = result;

    if (available || throwIfUnavailable === false) {
      return result;
    }

    if (reason === 'INVALID') {
      throw new Error(
        `Sorry, this namespace is invalid. A namespace must be composed of lowercase letters, numbers and dashes ("-").`
      );
    }

    if (reason === 'TOO_SHORT') {
      throw new Error(`Sorry, a namespace must have a minimum of 2 characters`);
    }

    if (reason === 'ALREADY_TAKEN') {
      throw new Error(`Sorry, this namespace is alrady taken`);
    }

    if (reason === 'RESERVED') {
      throw new Error(`Sorry, this namespace is reserved`);
    }

    let contactSupport;
    if (type === 'USER') {
      contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think your ${SERVICE_NAME} account should have the namespace ${formattedNamespace}, please contact ${SERVICE_NAME} at ${formatURL(
        SUPPORT_EMAIL_ADDRESS
      )}.`;
    } else if (type === 'ORGANIZATION') {
      contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think your ${SERVICE_NAME} organization should have the namespace ${formattedNamespace}, please contact ${SERVICE_NAME} at ${formatURL(
        SUPPORT_EMAIL_ADDRESS
      )}.`;
    }

    if (reason === 'GENERIC') {
      throw new Error(
        `Sorry, this namespace is not available because it is a very generic term. ${contactSupport}`
      );
    }

    if (
      (type === 'USER' && reason === 'IMPORTANT_GITHUB_USER') ||
      (type === 'ORGANIZATION' && reason === 'IMPORTANT_GITHUB_ORGANIZATION')
    ) {
      let message;
      if (type === 'USER') {
        message = `There is a popular GitHub user named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most popular GitHub usernames are reserved for future ${SERVICE_NAME} namespaces.`;
      } else if (type === 'ORGANIZATION') {
        message = `There is a popular GitHub organization named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most popular GitHub identifiers are reserved for future ${SERVICE_NAME} namespaces.`;
      }

      if (result.userHasGitHubAccountConnection) {
        throw new Error(message);
      }

      emptyLine();
      printText(message);
      emptyLine();
      if (type === 'USER') {
        printText(
          `If the GitHub account named ${formattedNamespace} is yours and you care about this name, you can get it by connecting your ${SERVICE_NAME} account to your GitHub account. Don't worry, ${SERVICE_NAME} will only have access to your GitHub public information.`
        );
      } else if (type === 'ORGANIZATION') {
        printText(
          `If you are a public member of the GitHub organization ${formattedNamespace}, you can get this name for your ${SERVICE_NAME} organization by connecting your ${SERVICE_NAME} account to your GitHub account. Don't worry, ${SERVICE_NAME} will only have access to your GitHub public information.`
        );
      }
      emptyLine();
      const okay = await confirm(`Do you want to continue?`, {default: true});
      emptyLine();

      if (!okay) {
        return;
      }

      await this.connectGitHubAccount({parentAction});

      result = await this.checkNamespaceAvailability(namespace, type, {
        parentAction,
        throwIfUnavailable: false
      });

      ({available, reason} = result);

      if (available) {
        return result;
      }

      await this.disconnectGitHubAccount();

      if (type === 'USER' && reason === 'IMPORTANT_GITHUB_USER') {
        throw new Error(
          `Sorry, the username of the GitHub account you connected to is not ${formattedNamespace}.`
        );
      }

      if (type === 'ORGANIZATION' && reason === 'IMPORTANT_GITHUB_ORGANIZATION') {
        throw new Error(
          `Sorry, the GitHub account you connected to is not a public member of ${formattedNamespace} organization.`
        );
      }

      throw new Error(`Sorry, this namespace is not available.`);
    }

    if (type === 'USER' && reason === 'IMPORTANT_GITHUB_ORGANIZATION') {
      throw new Error(
        `Sorry, this namespace is not available because there is a popular GitHub organization named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most important GitHub organizations are reserved for future ${SERVICE_NAME} organizations or communities.`
      );
    }

    if (type === 'ORGANIZATION' && reason === 'IMPORTANT_GITHUB_USER') {
      throw new Error(
        `Sorry, this namespace is not available because there is a popular GitHub user named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most important GitHub usernames are reserved for future ${SERVICE_NAME} users.`
      );
    }

    if (reason === 'BIG_COMPANY') {
      throw new Error(
        `Sorry, this namespace is not available because it matches the name of a big company (${formatString(
          result.company
        )}).`
      );
    }

    if (reason === 'COMMON_NUMBER') {
      throw new Error(
        `Sorry, this namespace is not available because it is quite a common number. ${contactSupport}`
      );
    }

    if (reason === 'TOP_LEVEL_DOMAIN') {
      throw new Error(
        `Sorry, this namespace is not available because it is a Top Level Domain. ${contactSupport}`
      );
    }

    if (reason === 'COMMON_FILE_EXTENSION') {
      throw new Error(
        `Sorry, this namespace is not available because it is a common file extension. ${contactSupport}`
      );
    }

    if (reason === 'COMMON_ENGLISH_WORD' || reason === 'COMMON_TAG') {
      throw new Error(
        `Sorry, this namespace is not available because it is quite a common term. ${contactSupport}`
      );
    }

    throw new Error(`Sorry, this namespace is not available.`);
  }
  /* eslint-enable complexity */

  // === GitHub account connections ===

  async connectGitHubAccount({parentAction}) {
    const user = await this.getUser();

    const {body: {gitHubAccountConnectionURL}} = await task(
      async () => {
        const url = `${this.registryURL}/user/start-connect-github-account`;
        return await this._userRequest(authorization =>
          postJSON(url, {parentAction}, {authorization})
        );
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

    let app;
    if (user.email === 'mvilatest@3base.com') {
      app = 'Google Chrome Canary';
    }
    opn(gitHubAccountConnectionURL, {wait: false, app});

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
