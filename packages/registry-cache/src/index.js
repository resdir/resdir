import {join, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {ensureDirSync, moveSync} from 'fs-extra';
import {formatString} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {parseResourceName} from '@resdir/resource-name';
import {parseResourceSpecifier} from '@resdir/resource-specifier';
import {compareVersions} from '@resdir/version';
import VersionRange from '@resdir/version-range';

const debug = require('debug')('resdir:registry:cache');

/*
Cache is stored on disk as follow:

.resdir
  caches
    registry-cache
      resources
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

const RESOURCE_REQUESTS_DIRECTORY_NAME = 'requests';
const RESOURCE_VERSIONS_DIRECTORY_NAME = 'versions';
const RESOURCE_FILE_NAME = '@resource.json';

export class RegistryCache {
  constructor({client, runDirectory}) {
    if (!client) {
      throw new Error('\'client\' argument is missing');
    }
    if (!runDirectory) {
      throw new Error('\'runDirectory\' argument is missing');
    }
    this.client = client;
    this.resourceCacheDirectory = join(runDirectory, 'caches', 'registry-cache', 'resources');
  }

  async signUp(...args) {
    return await this.client.signUp(...args);
  }

  async signIn(...args) {
    return await this.client.signIn(...args);
  }

  async signOut(...args) {
    return await this.client.signOut(...args);
  }

  async showUser(...args) {
    return await this.client.showUser(...args);
  }

  async deleteUser(...args) {
    return await this.client.deleteUser(...args);
  }

  async createUserNamespace(...args) {
    return await this.client.createUserNamespace(...args);
  }

  async removeUserNamespace(...args) {
    return await this.client.removeUserNamespace(...args);
  }

  async connectGitHubAccount(...args) {
    return await this.client.connectGitHubAccount(...args);
  }

  async disconnectGitHubAccount(...args) {
    return await this.client.disconnectGitHubAccount(...args);
  }

  async createOrganization(...args) {
    return await this.client.createOrganization(...args);
  }

  async deleteOrganization(...args) {
    return await this.client.deleteOrganization(...args);
  }

  async listUserOrganizations(...args) {
    return await this.client.listUserOrganizations(...args);
  }

  async addOrganizationMember(...args) {
    return await this.client.addOrganizationMember(...args);
  }

  async removeOrganizationMember(...args) {
    return await this.client.removeOrganizationMember(...args);
  }

  async fetchResource(specifier) {
    const result = await this._fetchResource(specifier);
    debug('fetchResource(%o) => %o', specifier, result);
    return result;
  }

  async _fetchResource(specifier) {
    const {name, versionRange} = parseResourceSpecifier(specifier);

    let result;

    result = await this._fetchResourceCache(name, versionRange);
    const cacheStatus = result.cacheStatus;
    if (cacheStatus === 'HIT') {
      return result;
    }

    const cachedVersion = await this._findLatestCachedResourceVersion(name, versionRange);

    result = await this.client.fetchResource(specifier, {cachedVersion});
    if (!result) {
      return undefined;
    }

    if (result.unchanged) {
      await this._saveCachedResourceRequest(name, versionRange, cachedVersion);
      result = await this._loadCachedResourceVersion(name, cachedVersion);
      return {...result, cacheStatus};
    }

    const definition = result.definition;
    const version = definition['@version'];
    await this._saveCachedResourceRequest(name, versionRange, version);

    const temporaryDirectory = result.directory;
    const directory = await this._saveCachedResourceVersion(
      name,
      version,
      definition,
      temporaryDirectory
    );

    return {definition, directory, cacheStatus};
  }

  async _fetchResourceCache(name, versionRange) {
    const requestFile = this._getCachedResourceRequestFile(name, versionRange);
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

    const result = await this._loadCachedResourceVersion(name, version, {throwIfNotFound: false});
    if (!result) {
      return {cacheStatus: 'CORRUPTED'};
    }

    return {...result, cacheStatus: 'HIT'};
  }

  async _invalidateResourceCache(name, version) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, identifier);
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

  async _saveCachedResourceRequest(name, versionRange, version) {
    const requestFile = this._getCachedResourceRequestFile(name, versionRange);
    const expiresOn = this._createResourceExpirationDate();
    const data = {version, expiresOn};
    ensureDirSync(dirname(requestFile));
    save(requestFile, data);
  }

  _getCachedResourceRequestFile(name, versionRange) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, identifier);
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

  async _loadCachedResourceVersion(name, version, {throwIfNotFound = true} = {}) {
    const file = this._getCachedResourceFile(name, version);
    const directory = dirname(file);
    const definition = load(file, {throwIfNotFound});
    if (!definition) {
      return undefined;
    }
    return {definition, directory};
  }

  async _saveCachedResourceVersion(name, version, definition, temporaryDirectory) {
    const file = this._getCachedResourceFile(name, version);
    const directory = dirname(file);
    if (existsSync(directory)) {
      // Should rarely happen
      return directory;
    }
    moveSync(temporaryDirectory, directory);
    save(file, definition);
    return directory;
  }

  _getCachedResourceFile(name, version) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, identifier);
    const versionsDirectory = join(resourceDirectory, RESOURCE_VERSIONS_DIRECTORY_NAME);
    const directory = join(versionsDirectory, version);
    const file = join(directory, RESOURCE_FILE_NAME);
    return file;
  }

  async _findLatestCachedResourceVersion(name, versionRange) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(this.resourceCacheDirectory, namespace, identifier);
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

  async publishResource(definition, directory) {
    await this.client.publishResource(definition, directory);
    await this._invalidateResourceCache(definition['@name'], definition['@version']);
  }
}

export default RegistryCache;
