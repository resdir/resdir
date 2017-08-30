import {join, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {homedir} from 'os';
import {ensureDirSync, moveSync} from 'fs-extra';
import {formatString} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {parseResourceName} from '@resdir/resource-name';
import {parseResourceSpecifier} from '@resdir/resource-specifier';
import {compareVersions} from '@resdir/version';
import VersionRange from '@resdir/version-range';

const debug = require('debug')('resdir:registry:cache');

const CACHE_DIRECTORY = join(homedir(), '.resdir', 'caches', 'registry-proxy');
const RESOURCE_CACHE_DIRECTORY = join(CACHE_DIRECTORY, 'resources');
const RESOURCE_REQUESTS_DIRECTORY_NAME = 'requests';
const RESOURCE_VERSIONS_DIRECTORY_NAME = 'versions';
const RESOURCE_FILE_NAME = '@resource.json';

/*
Cache is stored on disk as follow:

  registry-proxy
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

export class RegistryCache {
  constructor(client) {
    this.client = client;
  }

  async fetch(specifier) {
    const result = await this._fetch(specifier);
    debug('fetch(%o) => %o', specifier, result);
    return result;
  }

  async _fetch(specifier) {
    const {name, versionRange} = parseResourceSpecifier(specifier);

    let result;

    result = await this._fetchCache(name, versionRange);
    const cacheStatus = result.cacheStatus;
    if (cacheStatus === 'HIT') {
      return result;
    }

    const cachedVersion = await this._findLatestCachedVersion(name, versionRange);

    result = await this.client.fetch(specifier, {cachedVersion});
    if (!result) {
      return undefined;
    }

    if (result.unchanged) {
      await this._saveCachedRequest(name, versionRange, cachedVersion);
      result = await this._loadCachedVersion(name, cachedVersion);
      return {...result, cacheStatus};
    }

    const definition = result.definition;
    const version = definition['@version'];
    await this._saveCachedRequest(name, versionRange, version);

    const temporaryDirectory = result.directory;
    const directory = await this._saveCachedVersion(name, version, definition, temporaryDirectory);

    return {definition, directory, cacheStatus};
  }

  async _fetchCache(name, versionRange) {
    const requestFile = this._getCachedRequestFile(name, versionRange);
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

    const result = await this._loadCachedVersion(name, version, {throwIfNotFound: false});
    if (!result) {
      return {cacheStatus: 'CORRUPTED'};
    }

    return {...result, cacheStatus: 'HIT'};
  }

  async _invalidateCache(name, version) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(RESOURCE_CACHE_DIRECTORY, namespace, identifier);
    const requestsDirectory = join(resourceDirectory, RESOURCE_REQUESTS_DIRECTORY_NAME);

    if (!existsSync(requestsDirectory)) {
      return;
    }

    const filenames = readdirSync(requestsDirectory).filter(file => !file.startsWith('.'));
    for (const filename of filenames) {
      const versionRange = this._cachedRequestFilenameToVersionRange(filename);
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

  async _saveCachedRequest(name, versionRange, version) {
    const requestFile = this._getCachedRequestFile(name, versionRange);
    const expiresOn = this._createExpirationDate();
    const data = {version, expiresOn};
    ensureDirSync(dirname(requestFile));
    save(requestFile, data);
  }

  _getCachedRequestFile(name, versionRange) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(RESOURCE_CACHE_DIRECTORY, namespace, identifier);
    const requestsDirectory = join(resourceDirectory, RESOURCE_REQUESTS_DIRECTORY_NAME);
    const requestFile = join(
      requestsDirectory,
      this._versionRangeToCachedRequestFilename(versionRange)
    );
    return requestFile;
  }

  _versionRangeToCachedRequestFilename(versionRange) {
    return (versionRange.toString() || '_') + '.json';
  }

  _cachedRequestFilenameToVersionRange(filename) {
    if (!filename.endsWith('.json')) {
      throw new Error(`Invalid cached request filename: ${formatString(filename)}`);
    }
    let versionRange = filename.slice(0, -5);
    if (versionRange === '_') {
      versionRange = '';
    }
    return new VersionRange(versionRange);
  }

  async _loadCachedVersion(name, version, {throwIfNotFound = true} = {}) {
    const file = this._getCachedResourceFile(name, version);
    const directory = dirname(file);
    const definition = load(file, {throwIfNotFound});
    if (!definition) {
      return undefined;
    }
    return {definition, directory};
  }

  async _saveCachedVersion(name, version, definition, temporaryDirectory) {
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
    const resourceDirectory = join(RESOURCE_CACHE_DIRECTORY, namespace, identifier);
    const versionsDirectory = join(resourceDirectory, RESOURCE_VERSIONS_DIRECTORY_NAME);
    const directory = join(versionsDirectory, version);
    const file = join(directory, RESOURCE_FILE_NAME);
    return file;
  }

  async _findLatestCachedVersion(name, versionRange) {
    const {namespace, identifier} = parseResourceName(name);
    const resourceDirectory = join(RESOURCE_CACHE_DIRECTORY, namespace, identifier);
    const versionsDirectory = join(resourceDirectory, RESOURCE_VERSIONS_DIRECTORY_NAME);

    if (!existsSync(versionsDirectory)) {
      return undefined;
    }

    const cachedVersions = readdirSync(versionsDirectory).filter(file => !file.startsWith('.'));
    const latestCachedVersion = versionRange.findMaximum(cachedVersions);

    return latestCachedVersion;
  }

  _createExpirationDate() {
    // Randomly create an expiration date from 3 to 4 days
    const DAY = 24 * 60 * 60;
    let seconds = 3 * DAY;
    seconds += Math.floor(Math.random() * DAY);
    const milliseconds = seconds * 1000;
    return new Date(Date.now() + milliseconds);
  }

  async publish(definition, directory) {
    await this._publish(definition, directory);
    debug('publish(%o, %o)', definition, directory);
  }

  async _publish(definition, directory) {
    await this.client.publish(definition, directory);
    await this._invalidateCache(definition['@name'], definition['@version']);
  }
}

export default RegistryCache;
