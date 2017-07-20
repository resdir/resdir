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
}

export default Version;
