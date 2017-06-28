import {formatString, formatCode} from 'run-common';
import {VersionRange} from 'run-core';

import {fetchNPMRegistry} from './common';

export class Dependency {
  constructor(definition) {
    if (definition === undefined) {
      throw new Error("'definition' argument is missing");
    }

    if (typeof definition === 'string') {
      definition = {package: definition};
    }

    if (typeof definition !== 'object') {
      throw new Error('Dependency definition must be a string or an object');
    }

    const packageIdentifier = definition.package;
    if (packageIdentifier) {
      const {name, version} = Dependency.parsePackageIdentifier(packageIdentifier);

      if (!name) {
        throw new Error(`Dependency ${formatCode('name')} is missing`);
      }
      this.name = name;

      if (version) {
        this.version = version;
      }
    }

    this.type = definition.type || 'production';
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
    let packageIdentifier = this.name;
    if (this.version) {
      packageIdentifier += '@' + this.version.toString();
    }
    let json = {package: packageIdentifier};
    if (this.type !== 'production') {
      json.type = this.type;
    }
    if (Object.keys(json).length === 1) {
      // If there is only one property, it must be the package property and we can simplify the JSON
      json = json.package;
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
