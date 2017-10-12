import {join, isAbsolute} from 'path';
import {isEqual} from 'lodash';
import {formatString, formatPath, formatCode} from '@resdir/console';
import {VersionRange} from '@resdir/version-range';
import {load} from '@resdir/file-manager';

import {fetchNPMRegistry} from '@resdir/package-manager';

const DEFAULT_TYPE = 'production';

export class Dependency {
  constructor(definition, {type} = {}) {
    if (definition === undefined) {
      throw new Error('\'definition\' argument is missing');
    }

    if (typeof definition === 'string') {
      const {name, version, location} = Dependency.parsePackageSpecifier(definition);
      if (!name) {
        throw new Error(`Dependency ${formatCode('name')} is missing`);
      }
      definition = {name, version, location};
    }

    if (typeof definition !== 'object') {
      throw new Error('Dependency definition must be a string or an object');
    }

    this.name = definition.name;
    if (definition.version) {
      this.version = definition.version;
    }
    if (definition.location) {
      this.location = definition.location;
    }
    this.type = definition.type || type || DEFAULT_TYPE;
  }

  get version() {
    return this._version;
  }

  set version(version) {
    if (typeof version === 'string') {
      version = new VersionRange(version);
    }
    this._version = version;
  }

  static parsePackageSpecifier(pkg) {
    if (pkg.startsWith('.') || isAbsolute(pkg)) {
      let location = pkg;
      const packageFile = join(location, 'package.json');
      pkg = load(packageFile, {throwIfNotFound: false});
      if (!pkg) {
        throw new Error(`No ${formatPath('package.json')} file found at ${formatPath(location)}`);
      }
      const name = pkg.name;
      if (!name) {
        throw new Error(
          `Invalid ${formatPath('package.json')} file at ${formatPath(location)}: ${formatCode(
            'name'
          )} property is undefined`
        );
      }
      location = 'file:' + location;
      return {name, location};
    }

    let name = pkg;
    let version;
    let location;
    const index = name.indexOf('@', 1);
    if (index !== -1) {
      const versionOrLocation = name.slice(index + 1);
      name = name.slice(0, index);
      if (versionOrLocation.startsWith('file:')) {
        location = versionOrLocation;
      } else {
        version = versionOrLocation;
      }
    }
    return {name, version, location};
  }

  toJSON() {
    let json = {name: this.name};
    if (this.version) {
      json.version = this.version.toString();
    }
    if (this.location) {
      json.location = this.location;
    }
    if (this.type !== DEFAULT_TYPE) {
      json.type = this.type;
    }

    const keys = Object.keys(json);
    if (isEqual(keys, ['name'])) {
      json = json.name;
    } else if (isEqual(keys, ['name', 'version'])) {
      json = json.name + '@' + json.version;
    } else if (isEqual(keys, ['name', 'location'])) {
      json = json.name + '@' + json.location;
    }

    return json;
  }

  async fetchLatestVersion() {
    const pkg = await fetchNPMRegistry(this.name);
    const latestVersion = pkg['dist-tags'] && pkg['dist-tags'].latest;
    if (!latestVersion) {
      throw new Error(`Latest version not found for npm package ${formatString(this.name)}`);
    }
    return latestVersion;
  }
}

export default Dependency;
