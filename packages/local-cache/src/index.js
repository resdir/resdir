import {join} from 'path';
import {readFileSync, writeFileSync, statSync, existsSync, mkdirSync} from 'fs';
import {tmpdir} from 'os';
import strictUriEncode from 'strict-uri-encode';

const DEFAULT_TIME = 60 * 1000; // 1 minute

export class LocalCache {
  constructor({time = DEFAULT_TIME} = {}) {
    this.time = time;
  }

  async read(key, {encoding} = {}) {
    const file = this._getFile(key);

    let stats;
    try {
      stats = statSync(file);
    } catch (err) {
      /* File is missing */
    }

    if (stats && Date.now() - stats.mtime.getTime() < this.time) {
      return readFileSync(file, {encoding});
    }
  }

  async write(key, data, {encoding} = {}) {
    const file = this._getFile(key);
    writeFileSync(file, data, {encoding});
  }

  _getDirectory() {
    if (!this._directory) {
      this._directory = join(tmpdir(), 'resdir-local-cache');
      if (!existsSync(this._directory)) {
        mkdirSync(this._directory);
      }
    }
    return this._directory;
  }

  _getFile(key) {
    if (typeof key !== 'string') {
      throw new Error('\'key\' argument must be a string');
    }
    if (!key) {
      throw new Error('\'key\' argument is empty');
    }
    return join(this._getDirectory(), strictUriEncode(key));
  }
}

export default LocalCache;
