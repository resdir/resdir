import semver from 'semver';
import {formatString} from '@resdir/console';

export class Version {
  constructor(str) {
    const value = semver.clean(str);
    if (!value) {
      throw new Error(`Version ${formatString(str)} is invalid`);
    }
    this.value = value;
  }

  static normalize(version) {
    if (version === undefined) {
      return undefined;
    }
    if (typeof version === 'string') {
      return new this(version);
    }
    if (version instanceof this) {
      return version;
    }
    throw new Error('Invalid \'version\' argument');
  }

  bump(part = 'patch') {
    this.value = semver.inc(this.value, part);
    return this;
  }

  toJSON() {
    return this.toString();
  }

  toString() {
    return this.value;
  }

  toArray() {
    const value = this.value;
    const array = [semver.major(value), semver.minor(value), semver.patch(value)];
    const prerelease = semver.prerelease(value);
    if (prerelease) {
      array.push(...prerelease);
    }
    return array;
  }

  static fromArray(array) {
    if (!Array.isArray(array)) {
      throw new Error('\'array\' argument must be an array');
    }

    if (array.length < 3) {
      throw new Error('\'array\' argument is invalid');
    }

    const [major, minor, patch, ...prerelease] = array;
    let value = String(major) + '.' + String(minor) + '.' + String(patch);
    if (prerelease.length) {
      value += '-' + prerelease.join('.');
    }
    return new this(value);
  }
}

export default Version;
