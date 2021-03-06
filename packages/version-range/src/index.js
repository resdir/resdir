import {compact} from 'lodash';
import semver from 'semver';
import {formatString} from '@resdir/console';
import {createClientError} from '@resdir/error';

const MAXIMUM_NUMBER = 999999999;

export class VersionRange {
  constructor(input = {}) {
    if (typeof input === 'string') {
      input = parse(input);
    }
    this.type = input.type || 'ANY';
    this.value = input.value;
    this.exclusions = [...(input.exclusions || [])];
  }

  clone() {
    return new VersionRange(this);
  }

  getInclusiveBegin() {
    const version = this.simplify();
    const type = version.type;
    if (type === 'AFTER') {
      const value = version.value;
      return value.slice(2);
    }
    if (type === 'BETWEEN') {
      const value = version.value.split(',')[0];
      return value.slice(2);
    }
    throw new Error(`Can't get range begin of version range of type ${formatString(type)}`);
  }

  getInclusiveEnd() {
    const version = this.simplify();
    const type = version.type;
    if (type === 'BEFORE') {
      const value = version.value;
      return value.slice(2);
    }
    if (type === 'BETWEEN') {
      const value = version.value.split(',')[1];
      return value.slice(2);
    }
    throw new Error(`Can't get range begin of version range of type ${formatString(type)}`);
  }

  toString() {
    let str = this.value || '';
    for (const exclusion of this.exclusions) {
      if (str) {
        str += ',';
      }
      str += '!' + exclusion;
    }
    return str;
  }

  toJSON() {
    const str = this.toString();
    return str ? str : undefined;
  }

  includes(version) {
    version = semver.clean(version);
    if (!version) {
      throw createClientError(`Version ${formatString(version)} is invalid`);
    }

    if (this.exclusions.includes(version)) {
      return false;
    }

    if (this.type === 'ANY') {
      return true;
    }

    if (semver.satisfies(version, toNodeRange(this.value))) {
      return true;
    }

    return false;
  }

  findMaximum(versions) {
    versions = versions.filter(version => !this.exclusions.includes(version));
    const range = this.type === 'ANY' ? '>=0.0.0' : this.value;
    const version = semver.maxSatisfying(versions, toNodeRange(range));
    return version || undefined;
  }

  simplify() {
    const clone = this.clone();
    if (clone.type === 'TILDE') {
      clone._simplifyTilde();
    } else if (clone.type === 'CARET') {
      clone._simplifyCaret();
    } else if (clone.type === 'BEFORE') {
      clone._simplifyBefore();
    } else if (clone.type === 'AFTER') {
      clone._simplifyAfter();
    } else if (clone.type === 'BETWEEN') {
      clone._simplifyBetween();
    }
    return clone;
  }

  _simplifyTilde() {
    let from = this.value.slice(1);
    const [majorString, minorString, patchString] = from.split('.');
    from = [majorString || '0', minorString || '0', patchString || '0'].join('.');
    let major = Number(majorString) || 0;
    let minor = Number(minorString) || 0;
    let patch = Number(patchString) || 0;
    if (patchString) {
      // ~1.2.3: >=1.2.3,<1.3.0
      minor++;
      patch = 0;
    } else if (minorString) {
      // ~1.2: >=1.2.0,<1.3.0
      minor++;
    } else {
      // ~1: >=1.0.0,<2.0.0
      major++;
    }
    const to = `${major}.${minor}.${patch}`;
    this.type = 'BETWEEN';
    this.value = `>=${from},<${to}`;
    this._simplifyBetween();
  }

  _simplifyCaret() {
    const from = this.value.slice(1);
    let major = semver.major(from);
    let minor = semver.minor(from);
    let patch = semver.patch(from);
    if (major >= 1) {
      major++;
      minor = 0;
      patch = 0;
    } else if (minor >= 1) {
      minor++;
      patch = 0;
    } else {
      patch++;
    }
    const to = `${major}.${minor}.${patch}`;
    this.type = 'BETWEEN';
    this.value = `>=${from},<${to}`;
    this._simplifyBetween();
  }

  _simplifyBefore() {
    let value = this.value;
    if (!value.startsWith('<=')) {
      value = value.slice(1);
      value = decrement(value);
      this.value = `<=${value}`;
    }
  }

  _simplifyAfter() {
    let value = this.value;
    if (!value.startsWith('>=')) {
      value = value.slice(1);
      value = increment(value);
      this.value = `>=${value}`;
    }
  }

  _simplifyBetween() {
    let [value1, value2] = this.value.split(',');
    if (!value1.startsWith('>=')) {
      value1 = value1.slice(1);
      value1 = increment(value1);
      value1 = '>=' + value1;
    }
    if (!value2.startsWith('<=')) {
      value2 = value2.slice(1);
      value2 = decrement(value2);
      value2 = '<=' + value2;
    }
    this.value = `${value1},${value2}`;
  }
}

function parse(str) {
  // '': All versions
  // '1.2.0': Exact version
  // '^1.0.0': Caret range
  // '~1.0.0': Tilde range
  // '<1.0.0':  Before range
  // '>=1.5.0':  After range
  // '>=1.0.0,<2.0.0':  Between range
  // '!1.2.3': Exclusion
  // '^1.0.0,!1.2.3': Range with an exclusion

  str = str.trim();
  str = str.replace(/\s/g, ',');

  if (str === '') {
    return {};
  }

  const exactVersion = semver.clean(str);
  if (exactVersion) {
    // '0.3.2', '2.3.1-beta',...
    return {type: 'EXACT', value: exactVersion};
  }

  const error = createClientError(`Version range ${formatString(str)} is invalid`);

  let type;
  let value;
  const exclusions = [];

  const parts = [];
  for (const part of compact(str.split(','))) {
    if (part.startsWith('!')) {
      const exclusion = semver.clean(part.substr(1));
      if (!exclusion) {
        throw error;
      }
      exclusions.push(exclusion);
    } else {
      parts.push(part);
    }
  }

  if (parts.length > 2) {
    throw error;
  }

  if (parts.length === 0) {
    type = 'ANY';
  } else {
    if (parts[0].startsWith('~')) {
      if (parts.length > 1) {
        throw error;
      }
      type = 'TILDE';
    } else if (parts[0].startsWith('^')) {
      if (parts.length > 1) {
        throw error;
      }
      type = 'CARET';
    } else if (parts[0].startsWith('<')) {
      if (parts.length > 1) {
        throw error;
      }
      type = 'BEFORE';
    } else if (parts[0].startsWith('>')) {
      if (parts.length === 1) {
        type = 'AFTER';
      } else {
        if (!parts[1].startsWith('<')) {
          throw error;
        }
        type = 'BETWEEN';
      }
    } else {
      throw error;
    }

    value = parts.join(',');

    if (!semver.validRange(toNodeRange(value))) {
      throw error;
    }
  }

  return {type, value, exclusions};
}

function decrement(version) {
  let major = semver.major(version);
  let minor = semver.minor(version);
  let patch = semver.patch(version);
  if (patch > 0) {
    patch--;
  } else if (minor > 0) {
    minor--;
    patch = MAXIMUM_NUMBER;
  } else if (major > 0) {
    major--;
    minor = MAXIMUM_NUMBER;
    patch = MAXIMUM_NUMBER;
  } else {
    throw createClientError("Can't decrement a version equal to 0.0.0");
  }
  return `${major}.${minor}.${patch}`;
}

function increment(version) {
  const major = semver.major(version);
  const minor = semver.minor(version);
  const patch = semver.patch(version) + 1;
  return `${major}.${minor}.${patch}`;
}

function toNodeRange(value) {
  return value.replace(/,/g, ' ');
}

export default VersionRange;
