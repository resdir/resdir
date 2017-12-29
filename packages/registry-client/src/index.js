import {join, resolve, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {upperFirst} from 'lodash';
import {ensureDirSync, moveSync} from 'fs-extra';
import hasha from 'hasha';
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
  printText as originalPrintText,
  prompt,
  confirm,
  task
} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {parseResourceIdentifier} from '@resdir/resource-identifier';
import {parseResourceSpecifier, validateResourceSpecifier} from '@resdir/resource-specifier';
import {compareVersions} from '@resdir/version';
import VersionRange from '@resdir/version-range';
import generateSecret from '@resdir/secret-generator';
import {getJSON, postJSON, deleteJSON, get, put} from '@resdir/http-client';
import {gzipSync, gunzipSync} from 'zlib';
import {zip, unzip} from '@resdir/archive-manager';
import {SERVICE_NAME, SUPPORT_EMAIL_ADDRESS, REGISTRY_URL} from '@resdir/information';

const debug = require('debug')('resdir:registry:client');

// TODO: Change this configuration when production is deployed
const AWS_REGION = 'ap-northeast-1';
const AWS_S3_BUCKET_NAME = 'resdir-registry-dev-v1';
const AWS_S3_RESOURCE_UPLOADS_PREFIX = 'resources/uploads/';

const RESOURCE_REQUESTS_DIRECTORY_NAME = 'requests';
const RESOURCE_VERSIONS_DIRECTORY_NAME = 'versions';
const RESOURCE_FILE_NAME = '@resource.json';

/*
Data are stored on disk as follow:

<clientDirectory>
  resdir-registry
    data.json
    resource-cache
      resdir
        example
          requests
            _.json => {"version":"0.2.0","expiresOn":"..."}
            ^0.1.0.json => {"version":"0.1.2","expiresOn":"..."}
          versions
            0.1.2
              @resource.json
              dist
                index.js
*/

export class RegistryClient {
  constructor({
    registryURL,
    clientId,
    clientDirectory,
    awsRegion,
    awsS3BucketName,
    awsS3ResourceUploadsPrefix
  }) {
    if (!clientId) {
      throw new Error('\'clientId\' argument is missing');
    }
    if (!clientDirectory) {
      throw new Error('\'clientDirectory\' argument is missing');
    }

    this.registryURL = registryURL || REGISTRY_URL;
    this.clientId = clientId;
    this.clientDirectory = clientDirectory;
    this.awsRegion = awsRegion || AWS_REGION;
    this.awsS3BucketName = awsS3BucketName || AWS_S3_BUCKET_NAME;
    this.awsS3ResourceUploadsPrefix = awsS3ResourceUploadsPrefix || AWS_S3_RESOURCE_UPLOADS_PREFIX;

    this.dataFile = join(clientDirectory, 'resdir-registry', 'data.json');
    this.resourceCacheDirectory = join(clientDirectory, 'resdir-registry', 'resource-cache');
  }

  // === Users ===

  async signUp(email, {namespace, permissionToken} = {}) {
    return await this._signUpOrSignIn('SIGN_UP', email, {namespace, permissionToken});
  }

  async signIn(email) {
    return await this._signUpOrSignIn('SIGN_IN', email);
  }

  async _signUpOrSignIn(action, email, {namespace, permissionToken} = {}) {
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
          this._saveUserRefreshToken(refreshToken);
          completed = true;
        },
        {intro: `Completing ${messagePart}...`, outro: `${upperFirst(messagePart)} completed`}
      );
    }

    if (action === 'SIGN_UP') {
      await this.createUserNamespace(namespace, {permissionToken});
    }
  }

  async signOut() {
    this._ensureSignedInUser();

    await task(
      async () => {
        const url = `${this.registryURL}/user/sign-out`;
        const refreshToken = this._loadUserRefreshToken();
        await postJSON(url, {refreshToken});
      },
      {intro: `Signing out...`, outro: `Signed out`}
    );

    this._signOut();
  }

  _signOut() {
    this._saveUserId(undefined);
    this._saveUserRefreshToken(undefined);
    this._saveUserAccessToken(undefined);
  }

  async showUser() {
    console.dir(await this.getUser(), {depth: null, colors: true});
  }

  async deleteUser() {
    const user = await this.getUser();

    emptyLine();
    const okay = await confirm(`Are you sure you want to delete your account (${formatString(user.email)})?`);
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

  async createOrganization(namespace, {permissionToken} = {}) {
    this._ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Organization namespace: ${formatExample('twitter')}`);
      emptyLine();
    }

    await this.checkNamespaceAvailability(namespace, 'ORGANIZATION', {
      permissionToken,
      parentAction: 'CREATE_ORGANIZATION'
    });

    await task(
      async () => {
        const url = `${this.registryURL}/organizations`;
        await this._userRequest(authorization =>
          postJSON(url, {namespace, permissionToken}, {authorization}));
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
    const okay = await confirm(`Are you sure you want to delete ${formatString(namespace)} organization?`);
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
    while (!organizationNamespace) {
      emptyLine();
      organizationNamespace = await prompt(`Organization namespace:`);
      emptyLine();
    }

    const organization = await this.getOrganizationByNamespace(organizationNamespace);

    while (!userNamespace) {
      emptyLine();
      userNamespace = await prompt(`User namespace:`);
      emptyLine();
    }

    const user = await this.getUserByNamespace(userNamespace);

    await task(
      async () => {
        const url = `${this.registryURL}/organizations/${organization.id}/members`;
        await this._userRequest(authorization =>
          postJSON(url, {memberId: user.id}, {authorization}));
      },
      {
        intro: `Adding member...`,
        outro: `Member added`
      }
    );
  }

  async removeOrganizationMember(organizationNamespace, userNamespace) {
    while (!organizationNamespace) {
      emptyLine();
      organizationNamespace = await prompt(`Organization namespace:`);
      emptyLine();
    }

    const organization = await this.getOrganizationByNamespace(organizationNamespace);

    while (!userNamespace) {
      emptyLine();
      userNamespace = await prompt(`User namespace:`);
      emptyLine();
    }

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

  // === Communities ===

  async createCommunity(namespace, {permissionToken} = {}) {
    this._ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Community namespace: ${formatExample('js')}`);
      emptyLine();
    }

    await this.checkNamespaceAvailability(namespace, 'COMMUNITY', {
      permissionToken,
      parentAction: 'CREATE_COMMUNITY'
    });

    await task(
      async () => {
        const url = `${this.registryURL}/communities`;
        await this._userRequest(authorization =>
          postJSON(url, {namespace, permissionToken}, {authorization}));
      },
      {
        intro: `Creating community...`,
        outro: `Community created`
      }
    );
  }

  async deleteCommunity(namespace) {
    this._ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Community namespace:`);
      emptyLine();
    }

    const community = await this.getCommunityByNamespace(namespace);

    emptyLine();
    const okay = await confirm(`Are you sure you want to delete ${formatString(namespace)} community?`);
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
        const url = `${this.registryURL}/communities/${community.id}`;
        await this._userRequest(authorization => deleteJSON(url, {authorization}));
      },
      {
        intro: `Deleting ${formatString(namespace)} community...`,
        outro: `${formatString(namespace)} community deleted`
      }
    );
  }

  async getCommunityByNamespace(namespace) {
    if (!namespace) {
      throw new Error('\'namespace\' argument is missing');
    }

    const {body: [community]} = await task(
      async () => {
        const url = `${this.registryURL}/communities?namespace=${encodeURIComponent(namespace)}`;
        return await this._userRequest(authorization => getJSON(url, {authorization}));
      },
      {
        intro: `Fetching ${formatString(namespace)} community...`,
        outro: `${formatString(namespace)} community fetched`
      }
    );

    return community;
  }

  // === Namespaces ===

  async createUserNamespace(namespace, {permissionToken} = {}) {
    const user = await this.getUser();

    if (user.namespace) {
      throw new Error(`You already have a namespace (${formatString(user.namespace)})`);
    }

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Choose a name for your personal namespace: ${formatExample('aturing')}`);
      emptyLine();
    }

    await this.checkNamespaceAvailability(namespace, 'USER', {
      permissionToken,
      parentAction: 'CREATE_USER_NAMESPACE'
    });

    await task(
      async () => {
        const url = `${this.registryURL}/users/${user.id}/namespace`;
        await this._userRequest(authorization =>
          postJSON(url, {namespace, permissionToken}, {authorization}));
      },
      {
        intro: `Creating namespace ${formatString(namespace)}...`,
        outro: `Namespace ${formatString(namespace)} created`
      }
    );
  }

  async deleteUserNamespace() {
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
    {permissionToken, parentAction, throwIfUnavailable = true} = {}
  ) {
    if (!(type === 'USER' || type === 'ORGANIZATION' || type === 'COMMUNITY')) {
      throw new Error('Invalid \'type\'');
    }

    const formattedNamespace = formatString(namespace);

    let {body: result} = await task(
      async () => {
        const url = `${this.registryURL}/namespaces/check-availability`;
        return await this._userRequest(authorization =>
          postJSON(url, {namespace, type, permissionToken}, {authorization}));
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
      throw new Error(`Sorry, this namespace is invalid. A namespace must be composed of lowercase letters, numbers and dashes ("-").`);
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
      contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think your ${SERVICE_NAME} account should have the namespace ${formattedNamespace}, please contact ${SERVICE_NAME} at ${formatURL(SUPPORT_EMAIL_ADDRESS)}.`;
    } else if (type === 'ORGANIZATION') {
      contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think your ${SERVICE_NAME} organization should have the namespace ${formattedNamespace}, please contact ${SERVICE_NAME} at ${formatURL(SUPPORT_EMAIL_ADDRESS)}.`;
    } else if (type === 'COMMUNITY') {
      contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think you should have the namespace ${formattedNamespace} for your community, please contact ${SERVICE_NAME} at ${formatURL(SUPPORT_EMAIL_ADDRESS)}.`;
    }

    if (reason === 'GENERIC') {
      throw new Error(`Sorry, this namespace is not available because it is a very generic term. ${contactSupport}`);
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
        printText(`If the GitHub account named ${formattedNamespace} is yours and you care about this name, you can get it by connecting your ${SERVICE_NAME} account to your GitHub account. Don't worry, ${SERVICE_NAME} will only have access to your GitHub public information.`);
      } else if (type === 'ORGANIZATION') {
        printText(`If you are a public member of the GitHub organization ${formattedNamespace}, you can get this name for your ${SERVICE_NAME} organization by connecting your ${SERVICE_NAME} account to your GitHub account. Don't worry, ${SERVICE_NAME} will only have access to your GitHub public information.`);
      }
      emptyLine();
      const okay = await confirm(`Do you want to continue?`, {default: true});
      emptyLine();

      if (!okay) {
        throw new Error('GitHub connection aborted');
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
        throw new Error(`Sorry, the username of the GitHub account you connected to is not ${formattedNamespace}.`);
      }

      if (type === 'ORGANIZATION' && reason === 'IMPORTANT_GITHUB_ORGANIZATION') {
        throw new Error(`Sorry, the GitHub account you connected to is not a public member of ${formattedNamespace} organization.`);
      }

      throw new Error(`Sorry, this namespace is not available.`);
    }

    if (reason === 'IMPORTANT_GITHUB_USER') {
      throw new Error(`Sorry, this namespace is not available because there is a popular GitHub user named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most important GitHub usernames are reserved for future ${SERVICE_NAME} users. ${contactSupport}`);
    }

    if (reason === 'IMPORTANT_GITHUB_ORGANIZATION') {
      throw new Error(`Sorry, this namespace is not available because there is a popular GitHub organization named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most important GitHub organizations are reserved for future ${SERVICE_NAME} organizations or communities. ${contactSupport}`);
    }

    if (reason === 'BIG_COMPANY') {
      throw new Error(`Sorry, this namespace is not available because it matches the name of a big company (${formatString(result.company)}). ${contactSupport}`);
    }

    if (reason === 'COMMON_NUMBER') {
      throw new Error(`Sorry, this namespace is not available because it is quite a common number. ${contactSupport}`);
    }

    if (reason === 'TOP_LEVEL_DOMAIN') {
      throw new Error(`Sorry, this namespace is not available because it is a Top Level Domain. ${contactSupport}`);
    }

    if (reason === 'COMMON_FILE_EXTENSION') {
      throw new Error(`Sorry, this namespace is not available because it is a common file extension. ${contactSupport}`);
    }

    if (reason === 'COMMON_ENGLISH_WORD' || reason === 'COMMON_TAG') {
      throw new Error(`Sorry, this namespace is not available because it is quite a common term. ${contactSupport}`);
    }

    throw new Error(`Sorry, this namespace is not available. ${contactSupport}`);
  }

  /* eslint-enable complexity */

  // === GitHub account connections ===

  async connectGitHubAccount({parentAction} = {}) {
    const user = await this.getUser();

    const {body: {gitHubAccountConnectionURL}} = await task(
      async () => {
        const url = `${this.registryURL}/user/start-connect-github-account`;
        return await this._userRequest(authorization =>
          postJSON(url, {parentAction}, {authorization}));
      },
      {
        intro: `Fetching connection URL...`,
        outro: `Connection URL fetched`
      }
    );

    printSuccess(`GitHub connection page opened in your browser`);
    emptyLine();
    printText(`If the GitHub connection page doesn't open automatically, please copy/paste the following URL in your browser:`);
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
          postJSON(url, undefined, {authorization}));
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

  async fetchResource(specifier) {
    const result = await this._fetchResource(specifier);
    debug('fetchResource(%o) => %o', specifier, result);
    return result;
  }

  async _fetchResource(specifier) {
    const {identifier, versionRange} = parseResourceSpecifier(specifier);

    let result;

    result = await this._fetchResourceFromCache(identifier, versionRange);
    const cacheStatus = result.cacheStatus;
    if (cacheStatus === 'HIT') {
      return result;
    }

    const cachedVersion = await this._findLatestCachedResourceVersion(identifier, versionRange);

    result = await this._fetchResourceFromRegistry(specifier, {cachedVersion});
    if (!result) {
      return undefined;
    }

    if (result.unchanged) {
      await this._saveCachedResourceRequest(identifier, versionRange, cachedVersion);
      result = await this._loadCachedResourceVersion(identifier, cachedVersion);
      return {...result, cacheStatus};
    }

    const definition = result.definition;
    const version = definition.version;
    await this._saveCachedResourceRequest(identifier, versionRange, version);

    const temporaryDirectory = result.directory;
    const directory = await this._saveCachedResourceVersion(
      identifier,
      version,
      definition,
      temporaryDirectory
    );

    return {definition, directory, cacheStatus};
  }

  async _fetchResourceFromRegistry(specifier, {cachedVersion} = {}) {
    validateResourceSpecifier(specifier);

    let url = `${this.registryURL}/resources/${specifier}`;
    if (cachedVersion) {
      url += `?cachedVersion=${cachedVersion}`;
    }

    const {body: {unchanged, definitionURL, filesURL}} = await this._userRequest(authorization =>
      getJSON(url, {authorization}));

    if (unchanged) {
      return {unchanged};
    }

    let downloads = [get(definitionURL)];
    if (filesURL) {
      downloads.push(get(filesURL));
    }
    downloads = await Promise.all(downloads);

    const {body: compressedDefinition} = downloads[0];
    const definition = JSON.parse(gunzipSync(compressedDefinition).toString());

    let directory;
    if (filesURL) {
      directory = tempy.directory();
      // TODO: Instead of a buffer, use a stream to download and unzip files
      const {body: compressedFiles} = downloads[1];
      await unzip(directory, compressedFiles);
    }

    return {definition, directory};
  }

  async _fetchResourceFromCache(identifier, versionRange) {
    const requestFile = this._getCachedResourceRequestFile(identifier, versionRange);
    const data = load(requestFile, {throwIfNotFound: false});
    if (!data) {
      return {cacheStatus: 'MISS'};
    }

    const {version, expiresOn, invalidated} = data;

    if (expiresOn && new Date(expiresOn) < new Date()) {
      return {cacheStatus: 'EXPIRED'};
    }

    if (invalidated) {
      return {cacheStatus: 'INVALIDATED'};
    }

    const result = await this._loadCachedResourceVersion(identifier, version, {
      throwIfNotFound: false
    });
    if (!result) {
      return {cacheStatus: 'CORRUPTED'};
    }

    return {...result, cacheStatus: 'HIT'};
  }

  async _invalidateResourceCache(identifier, version) {
    const {namespace, name} = parseResourceIdentifier(identifier);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, name);
    const requestsDirectory = join(resourceDirectory, RESOURCE_REQUESTS_DIRECTORY_NAME);

    if (!existsSync(requestsDirectory)) {
      return;
    }

    const filenames = readdirSync(requestsDirectory).filter(file => !file.startsWith('.'));
    for (const filename of filenames) {
      const versionRange = this._cachedResourceRequestFilenameToVersionRange(filename);
      if (versionRange.includes(version)) {
        const requestFile = join(requestsDirectory, filename);
        const data = load(requestFile);
        if (compareVersions(version, '>', data.version)) {
          data.invalidated = true;
          save(requestFile, data);
        }
      }
    }
  }

  async _saveCachedResourceRequest(identifier, versionRange, version) {
    const requestFile = this._getCachedResourceRequestFile(identifier, versionRange);
    const expiresOn = this._createResourceExpirationDate();
    const data = {version, expiresOn};
    ensureDirSync(dirname(requestFile));
    save(requestFile, data);
  }

  _getCachedResourceRequestFile(identifier, versionRange) {
    const {namespace, name} = parseResourceIdentifier(identifier);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, name);
    const requestsDirectory = join(resourceDirectory, RESOURCE_REQUESTS_DIRECTORY_NAME);
    const requestFile = join(
      requestsDirectory,
      this._resourceVersionRangeToCachedRequestFilename(versionRange)
    );
    return requestFile;
  }

  _resourceVersionRangeToCachedRequestFilename(versionRange) {
    return (versionRange.toString() || '_') + '.json';
  }

  _cachedResourceRequestFilenameToVersionRange(filename) {
    if (!filename.endsWith('.json')) {
      throw new Error(`Invalid cached request filename: ${formatString(filename)}`);
    }
    let versionRange = filename.slice(0, -5);
    if (versionRange === '_') {
      versionRange = '';
    }
    return new VersionRange(versionRange);
  }

  async _loadCachedResourceVersion(identifier, version, {throwIfNotFound = true} = {}) {
    const file = this._getCachedResourceFile(identifier, version);
    const directory = dirname(file);
    const definition = load(file, {throwIfNotFound});
    if (!definition) {
      return undefined;
    }
    return {definition, directory};
  }

  async _saveCachedResourceVersion(identifier, version, definition, temporaryDirectory) {
    const file = this._getCachedResourceFile(identifier, version);
    const directory = dirname(file);
    if (existsSync(directory)) {
      // Should rarely happen
      return directory;
    }
    if (temporaryDirectory) {
      moveSync(temporaryDirectory, directory);
    } else {
      // The resource doesn't include any files
      ensureDirSync(directory);
    }
    save(file, definition);
    return directory;
  }

  _getCachedResourceFile(identifier, version) {
    const {namespace, name} = parseResourceIdentifier(identifier);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, name);
    const versionsDirectory = join(resourceDirectory, RESOURCE_VERSIONS_DIRECTORY_NAME);
    const directory = join(versionsDirectory, version);
    const file = join(directory, RESOURCE_FILE_NAME);
    return file;
  }

  async _findLatestCachedResourceVersion(identifier, versionRange) {
    const {namespace, name} = parseResourceIdentifier(identifier);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, name);
    const versionsDirectory = join(resourceDirectory, RESOURCE_VERSIONS_DIRECTORY_NAME);

    if (!existsSync(versionsDirectory)) {
      return undefined;
    }

    const cachedVersions = readdirSync(versionsDirectory).filter(file => !file.startsWith('.'));
    const latestCachedVersion = versionRange.findMaximum(cachedVersions);

    return latestCachedVersion;
  }

  _createResourceExpirationDate() {
    // Randomly create an expiration date from 3 to 4 days
    const DAY = 24 * 60 * 60;
    let seconds = 3 * DAY;
    seconds += Math.floor(Math.random() * DAY);
    const milliseconds = seconds * 1000;
    return new Date(Date.now() + milliseconds);
  }

  async publishResource(definition, directory, {permissionToken} = {}) {
    await this._publishResource(definition, directory, {permissionToken});
    debug('publishResource(%o, %o)', definition, directory);
  }

  async _publishResource(definition, directory, {permissionToken}) {
    if (!(this.awsRegion && this.awsS3BucketName && this.awsS3ResourceUploadsPrefix)) {
      throw new Error('AWS configuration is missing or incomplete');
    }

    this._ensureSignedInUser();

    const {id: identifier, version, isPublic} = definition;

    if (!identifier) {
      throw new Error(`Can't publish a resource without a ${formatCode('id')} property`);
    }

    if (!version) {
      throw new Error(`Can't publish a resource without a ${formatCode('version')} property`);
    }

    const uploads = [];

    const compressedDefinition = gzipSync(JSON.stringify(definition));
    const definitionKey = this.awsS3ResourceUploadsPrefix + generateSecret() + '.json.gz';
    uploads.push(this._uploadToS3({
      bucket: this.awsS3BucketName,
      key: definitionKey,
      body: compressedDefinition
    }));

    const files = await this._getFiles(definition, directory);
    if (files.length > 0) {
      // TODO: Instead of a buffer, use a stream to zip and upload files
      const compressedFiles = await zip(directory, files);
      const filesKey = this.awsS3ResourceUploadsPrefix + generateSecret() + '.zip';
      uploads.push(this._uploadToS3({
        bucket: this.awsS3BucketName,
        key: filesKey,
        body: compressedFiles
      }));
    }

    const [temporaryDefinitionURL, temporaryFilesURL] = await Promise.all(uploads);

    const url = `${this.registryURL}/resources`;
    await this._userRequest(authorization =>
      postJSON(
        url,
        {identifier, version, isPublic, temporaryDefinitionURL, temporaryFilesURL, permissionToken},
        {authorization}
      ));

    await this._invalidateResourceCache(identifier, version);
  }

  async _uploadToS3({bucket, key, body}) {
    const url = `https://${bucket}.s3.amazonaws.com/${key}`;
    const md5 = await hasha(body, {algorithm: 'md5', encoding: 'base64'});
    await put(url, body, {
      headers: {
        'Content-MD5': md5,
        'Content-Length': body.length,
        'x-amz-acl': 'bucket-owner-full-control'
      }
    });
    return url;
  }

  async _getFiles(definition, directory) {
    const files = [];

    const filesProperty = definition.files || [];
    for (const file of filesProperty) {
      const resolvedFile = resolve(directory, file);

      if (!existsSync(resolvedFile)) {
        throw new Error(`File ${formatPath(file)} specified in ${formatCode('files')} property doesn't exist`);
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

  // === Admin ===

  async createPermissionToken(permission, parameters) {
    this._ensureSignedInUser();

    await task(
      async progress => {
        const url = `${this.registryURL}/admin/permission-tokens`;
        const {body: {token}} = await this._userRequest(authorization =>
          postJSON(url, {permission, parameters}, {authorization}));
        progress.setOutro(`Permission token created: ${formatString(token)}`);
      },
      {
        intro: `Creating permission token...`
      }
    );
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
      this._userId = this._loadData().userId;
    }
    return this._userId;
  }

  _saveUserId(userId) {
    this._userId = userId;
    this._updateData({userId});
  }

  // === Authentication ===

  async _userRequest(fn) {
    let userAccessToken = await this._loadUserAccessToken();
    const request = async () => {
      const authorization = userAccessToken && `Bearer ${userAccessToken}`;
      return await fn(authorization);
    };
    try {
      return await request();
    } catch (err) {
      if (err.status === 401) {
        userAccessToken = await this._refreshUserAccessToken();
        return await request();
      }
      throw err;
    }
  }

  _loadUserRefreshToken() {
    if (!this._userRefreshToken) {
      this._userRefreshToken = this._loadData().userRefreshToken;
    }
    return this._userRefreshToken;
  }

  _saveUserRefreshToken(userRefreshToken) {
    this._userRefreshToken = userRefreshToken;
    this._updateData({userRefreshToken});
  }

  async _loadUserAccessToken() {
    if (!this._userAccessTokenValue) {
      const data = this._loadData();
      this._userAccessTokenValue = data.userAccessTokenValue;
      this._userAccessTokenExpiresOn = data.userAccessTokenExpiresOn;
      if (this._userAccessTokenExpiresOn) {
        this._userAccessTokenExpiresOn = new Date(this._userAccessTokenExpiresOn);
      }
    }
    if (!this._userAccessTokenValue) {
      await this._refreshUserAccessToken();
    }
    if (!this._userAccessTokenValue) {
      return undefined;
    }
    if (
      this._userAccessTokenExpiresOn &&
      Date.now() > this._userAccessTokenExpiresOn - 3 * 60 * 1000
    ) {
      // Refresh access token 3 minutes before expiration
      await this._refreshUserAccessToken();
    }
    return this._userAccessTokenValue;
  }

  async _refreshUserAccessToken() {
    debug('_refreshUserAccessToken()');
    let userAccessTokenValue;
    let userAccessTokenExpiresOn;
    try {
      const refreshToken = this._loadUserRefreshToken();
      if (!refreshToken) {
        return;
      }
      const url = `${this.registryURL}/user/access-tokens`;
      const {body: {accessToken: {value, expiresIn}}} = await postJSON(url, {refreshToken});
      userAccessTokenValue = value;
      userAccessTokenExpiresOn = new Date(Date.now() + expiresIn);
      return value;
    } finally {
      this._saveUserAccessToken(userAccessTokenValue, userAccessTokenExpiresOn);
    }
  }

  _saveUserAccessToken(userAccessTokenValue, userAccessTokenExpiresOn) {
    this._userAccessTokenValue = userAccessTokenValue;
    this._userAccessTokenExpiresOn = userAccessTokenExpiresOn;
    this._updateData({userAccessTokenValue, userAccessTokenExpiresOn});
  }

  // === Data ===

  _loadData() {
    return load(this.dataFile, {throwIfNotFound: false}) || {};
  }

  _saveData(data) {
    ensureDirSync(dirname(this.dataFile));
    save(this.dataFile, data);
  }

  _updateData(newData) {
    const data = this._loadData();
    Object.assign(data, newData);
    this._saveData(data);
  }
}

function printText(text) {
  originalPrintText(text, {width: 80});
}

export default RegistryClient;
