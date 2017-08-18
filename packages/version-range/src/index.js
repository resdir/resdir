import {compact} from 'lodash';
import semver from 'semver';

import {formatString} from '@resdir/console';

export class VersionRange {
  constructor(input = {}) {
    if (typeof input === 'string') {
      input = VersionRange._parseString(input);
    }
    this.type = input.type || 'any';
    if (input.value !== undefined) {
      this.value = input.value;
    }
    if (input.exclusions !== undefined) {
      this.exclusions = [...input.exclusions];
    }
  }

  static _parseString(str) {
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

  clone() {
    return new VersionRange(this);
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
  }

  _simplifyCaret() {
    const from = this.value.slice(1);
    const major = semver.major(from) + 1;
    const to = `${major}.0.0`;
    this.type = 'between';
    this.value = `>=${from},<${to}`;
  }
}

export default VersionRange;
