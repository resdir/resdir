import {isEqual} from 'lodash';
import {formatString, formatCode} from 'run-common';
import {VersionRange} from '@resdir/version-range';

import {fetchNPMRegistry} from '@resdir/package-manager';

const DEFAULT_TYPE = 'production';

export class Dependency {
  constructor(definition, {type} = {}) {
    if (definition === undefined) {
      throw new Error('\'definition\' argument is missing');
    }

    if (typeof definition === 'string') {
      const {name, version} = Dependency.parsePackageIdentifier(definition);
      if (!name) {
        throw new Error(`Dependency ${formatCode('name')} is missing`);
      }
      definition = {name, version};
    }

    if (typeof definition !== 'object') {
      throw new Error('Dependency definition must be a string or an object');
    }

    this.name = definition.name;
    if (definition.version) {
      this.version = definition.version;
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

  static parsePackageIdentifier(pkg) {
    let name = pkg;
    let version;
    const index = name.indexOf('@', 1);
    if (index !== -1) {
      version = name.slice(index + 1);
      name = name.slice(0, index);
    }
    return {name, version};
  }

  toJSON() {
    let json = {name: this.name};
    if (this.version) {
      json.version = this.version.toString();
    }
    if (this.type !== DEFAULT_TYPE) {
      json.type = this.type;
    }

    const keys = Object.keys(json);
    if (isEqual(keys, ['name'])) {
      json = json.name;
    } else if (isEqual(keys, ['name', 'version'])) {
      json = json.name + '@' + json.version;
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
