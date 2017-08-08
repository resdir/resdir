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
    if (typeof version === 'string') {
      version = new this(version);
    }
    return version;
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

  static serialize(version) {
    version = this.normalize(version);

    const value = version.value;
    const major = serializeNumber(semver.major(value));
    const minor = serializeNumber(semver.minor(value));
    const patch = serializeNumber(semver.patch(value));
    const prerelease = semver.prerelease(value);

    let result = major + '.' + minor + '.' + patch;
    if (prerelease) {
      result += '-' + prerelease.join('.');
    }
    return result;
  }

  static deserialize(version) {
    if (typeof version !== 'string') {
      throw new Error('\'version\' argument must be a string');
    }

    let [numbers, prerelease] = version.split('-');

    numbers = numbers.split('.');
    if (numbers.length !== 3) {
      throw new Error(`Invalid serialized version: ${version}`);
    }
    const major = deserializeNumber(numbers[0]);
    const minor = deserializeNumber(numbers[1]);
    const patch = deserializeNumber(numbers[2]);

    let result = String(major) + '.' + String(minor) + '.' + String(patch);

    if (prerelease) {
      result += '-' + prerelease;
    }

    return result;
  }
}

function serializeNumber(number) {
  if (number > 99999) {
    throw new Error('Can\'t serialize a number greater than 99999');
  }
  number = '0000' + String(number);
  number = number.slice(-5);
  return number;
}

function deserializeNumber(str) {
  if (str.length !== 5) {
    throw new Error(`Invalid serialized version number: ${str}`);
  }
  return Number(str);
}

export default Version;
