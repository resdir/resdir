import semver from 'semver';
import {formatString} from '@resdir/console';
import {createClientError} from '@resdir/error';

export class Version {
  constructor(str) {
    validateVersion(str);
    this.value = semver.clean(str);
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
    throw new Error("Invalid 'version' argument");
  }

  bump(part = 'patch') {
    this.value = semver.inc(this.value, part);
    return this;
  }

  getMajor() {
    return semver.major(this.value);
  }

  getMinor() {
    return semver.minor(this.value);
  }

  getPatch() {
    return semver.patch(this.value);
  }

  getPreRelease() {
    const preRelease = semver.prerelease(this.value);
    if (!preRelease) {
      return undefined;
    }
    return preRelease;
  }

  compareTo(other, comparator) {
    return compareVersions(this, comparator, other);
  }

  toJSON() {
    return this.toString();
  }

  toString() {
    return this.value;
  }

  toArray() {
    const array = [this.getMajor(), this.getMinor(), this.getPatch()];
    const preRelease = this.getPreRelease();
    if (preRelease) {
      array.push(...preRelease);
    }
    return array;
  }

  static fromArray(array) {
    if (!Array.isArray(array)) {
      throw new Error("'array' argument must be an array");
    }

    if (array.length < 3) {
      throw new Error("'array' argument is invalid");
    }

    const [major, minor, patch, ...prerelease] = array;
    let value = String(major) + '.' + String(minor) + '.' + String(patch);
    if (prerelease.length) {
      value += '-' + prerelease.join('.');
    }
    return new this(value);
  }
}

export function validateVersion(version, {throwIfInvalid = true} = {}) {
  const isValid = validate(version);

  if (!isValid) {
    if (throwIfInvalid) {
      if (version) {
        throw createClientError(`Version number ${formatString(version)} is invalid`);
      } else {
        throw createClientError(`Version number is missing`);
      }
    }
    return false;
  }

  return true;
}

function validate(version) {
  if (version instanceof Version) {
    return true;
  }

  if (typeof version !== 'string') {
    return false;
  }

  version = semver.clean(version);
  if (!version) {
    return false;
  }

  return true;
}

export function compareVersions(v1, comparator, v2) {
  return semver.cmp(String(v1), comparator, String(v2));
}

export default Version;
