import {compact} from 'lodash';
import semver from 'semver';

import {formatString} from '@resdir/console';

const MAXIMUM_NUMBER = 999999999;

export class VersionRange {
  constructor(input = {}) {
    if (typeof input === 'string') {
      input = parse(input);
    }
    this.type = input.type || 'any';
    if (input.value !== undefined) {
      this.value = input.value;
    }
    if (input.exclusions !== undefined) {
      this.exclusions = [...input.exclusions];
    }
  }

  clone() {
    return new VersionRange(this);
  }

  getInclusiveBegin() {
    const version = this.simplify();
    const type = version.type;
    if (type === 'after') {
      const value = version.value;
      return value.slice(2);
    } else if (type === 'between') {
      const value = version.value.split(',')[0];
      return value.slice(2);
    }
    throw new Error(`Can't get range begin of version range of type ${formatString(type)}`);
  }

  getInclusiveEnd() {
    const version = this.simplify();
    const type = version.type;
    if (type === 'before') {
      const value = version.value;
      return value.slice(2);
    } else if (type === 'between') {
      const value = version.value.split(',')[1];
      return value.slice(2);
    }
    throw new Error(`Can't get range begin of version range of type ${formatString(type)}`);
  }

  toString() {
    if (this.type === 'any') {
      return '';
    }
    let str = this.value;
    if (this.type === 'exact') {
      return str;
    }
    for (const exclusion of this.exclusions) {
      str += ',!' + exclusion;
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
      throw new Error(`Version ${formatString(version)} is invalid`);
    }

    if (this.type === 'any') {
      return true;
    }

    if (!semver.satisfies(version, this.value.replace(/,/g, ' '))) {
      return false;
    }

    if (this.exclusions && this.exclusions.includes(version)) {
      return false;
    }

    return true;
  }

  simplify() {
    const clone = this.clone();
    if (clone.type === 'tilde') {
      clone._simplifyTilde();
    } else if (clone.type === 'caret') {
      clone._simplifyCaret();
    } else if (clone.type === 'before') {
      clone._simplifyBefore();
    } else if (clone.type === 'after') {
      clone._simplifyAfter();
    } else if (clone.type === 'between') {
      clone._simplifyBetween();
    }
    return clone;
  }

  _simplifyTilde() {
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
    this.type = 'between';
    this.value = `>=${from},<${to}`;
    this._simplifyBetween();
  }

  _simplifyCaret() {
    const from = this.value.slice(1);
    const major = semver.major(from) + 1;
    const to = `${major}.0.0`;
    this.type = 'between';
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
  // '^1.0.0,!1.2.3': Range with an exclusion

  str = str.trim();
  str = str.replace(/\s/g, ',');

  if (str === '') {
    return {};
  }

  const exactVersion = semver.clean(str);
  if (exactVersion) {
    // '0.3.2', '2.3.1-beta',...
    return {type: 'exact', value: exactVersion};
  }

  const error = new Error(`Version range ${formatString(str)} is invalid`);

  const parts = [];
  const exclusions = [];
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

  let type;
  if (parts[0].startsWith('~')) {
    if (parts.length > 1) {
      throw error;
    }
    type = 'tilde';
  } else if (parts[0].startsWith('^')) {
    if (parts.length > 1) {
      throw error;
    }
    type = 'caret';
  } else if (parts[0].startsWith('<')) {
    if (parts.length > 1) {
      throw error;
    }
    type = 'before';
  } else if (parts[0].startsWith('>')) {
    if (parts.length === 1) {
      type = 'after';
    } else {
      if (!parts[1].startsWith('<')) {
        throw error;
      }
      type = 'between';
    }
  } else {
    throw error;
  }

  const value = parts.join(',');

  if (!semver.validRange(value.replace(/,/g, ' '))) {
    throw error;
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
    throw new Error('Can\'t decrement a version equal to 0.0.0');
  }
  return `${major}.${minor}.${patch}`;
}

function increment(version) {
  const major = semver.major(version);
  const minor = semver.minor(version);
  const patch = semver.patch(version) + 1;
  return `${major}.${minor}.${patch}`;
}

export default VersionRange;
