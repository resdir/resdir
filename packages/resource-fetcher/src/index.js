import {join, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {ensureDirSync, renameSync, removeSync} from 'fs-extra';
import {formatString} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {parseResourceIdentifier} from '@resdir/resource-identifier';
import {parseResourceSpecifier, validateResourceSpecifier} from '@resdir/resource-specifier';
import {compareVersions} from '@resdir/version';
import VersionRange from '@resdir/version-range';
import {get} from '@resdir/http-client';
import uniqueString from 'unique-string';
import {gunzipSync} from 'zlib';
import {unzip} from '@resdir/archive-manager';
import debugModule from 'debug';

const debug = debugModule('resdir:resource-fetcher');

const RESDIR_REGISTRY_DIRECTORY_NAME = 'resdir-registry';
const RESOURCE_CACHE_DIRECTORY_NAME = 'resource-cache';
const TEMPORARY_DIRECTORY_NAME = 'temporary';
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

export class ResourceFetcher {
  constructor({registryServer, clientDirectory}) {
    if (!registryServer) {
      throw new Error('\'registryServer\' argument is missing');
    }
    if (!clientDirectory) {
      throw new Error('\'clientDirectory\' argument is missing');
    }
    this.registryServer = registryServer;
    this.resourceCacheDirectory = join(
      clientDirectory,
      RESDIR_REGISTRY_DIRECTORY_NAME,
      RESOURCE_CACHE_DIRECTORY_NAME
    );
    this.temporaryDirectory = join(clientDirectory, TEMPORARY_DIRECTORY_NAME);
  }

  async fetch({specifier, accessToken}, environment) {
    const result = await this._fetch({specifier, accessToken}, environment);
    debug('fetch(%o) => %o', {specifier, accessToken}, result);
    return result;
  }

  async _fetch({specifier, accessToken}, environment) {
    const {identifier, versionRange} = parseResourceSpecifier(specifier);

    let {file, cacheStatus} = await this._fetchFromCache(identifier, versionRange);
    if (cacheStatus === 'HIT') {
      return {file, cacheStatus};
    }

    const cachedVersion = await this._findLatestCachedResourceVersion(identifier, versionRange);

    const {definition, directory, cachedVersionIsLatest} = await this._fetchFromRegistry(
      {specifier, cachedVersion, accessToken},
      environment
    );

    try {
      if (cachedVersionIsLatest) {
        await this._saveCachedResourceRequest(identifier, versionRange, cachedVersion);
        file = this._getCachedResourceFile(identifier, cachedVersion);
        return {file, cacheStatus};
      }

      const version = definition.version;

      await this._saveCachedResourceRequest(identifier, versionRange, version);

      file = await this._saveCachedResourceVersion(identifier, version, definition, directory);
    } catch (err) {
      if (directory && existsSync(directory)) {
        // In case of error, remove the temporary directory created by _fetchFromRegistry()
        removeSync(directory);
      }
      throw err;
    }

    return {file, cacheStatus};
  }

  async _fetchFromRegistry({specifier, cachedVersion, accessToken}, environment) {
    validateResourceSpecifier(specifier);

    const {
      definitionURL,
      filesURL,
      cachedVersionIsLatest
    } = await this.registryServer.fetchResource(
      {specifier, cachedVersion, accessToken},
      environment
    );

    if (cachedVersionIsLatest) {
      return {cachedVersionIsLatest};
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
      directory = join(this.temporaryDirectory, uniqueString());
      ensureDirSync(directory);
      try {
        // TODO: Instead of a buffer, use a stream to download and unzip files
        const {body: compressedFiles} = downloads[1];
        await unzip(directory, compressedFiles);
      } catch (err) {
        removeSync(directory);
        throw err;
      }
    }

    return {definition, directory};
  }

  async _fetchFromCache(identifier, versionRange) {
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

    const file = this._getCachedResourceFile(identifier, version);
    if (!existsSync(file)) {
      return {cacheStatus: 'CORRUPTED'};
    }

    return {file, cacheStatus: 'HIT'};
  }

  async invalidateResourceCache(identifier, version) {
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

  async _saveCachedResourceVersion(identifier, version, definition, temporaryDirectory) {
    const file = this._getCachedResourceFile(identifier, version);
    if (existsSync(file)) {
      // Should rarely happen
      return file;
    }
    const directory = dirname(file);
    if (temporaryDirectory) {
      ensureDirSync(dirname(directory));
      renameSync(temporaryDirectory, directory);
    } else {
      // The resource doesn't include any files
      ensureDirSync(directory);
    }
    save(file, definition);
    return file;
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
}

export default ResourceFetcher;
