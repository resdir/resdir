import {join} from 'path';
import {readFileSync, writeFileSync, existsSync} from 'fs';
import union from 'lodash.union';

export class GitIgnore {
  _entries = [];

  static load(directory) {
    return new this().load(directory);
  }

  load(directory) {
    if (directory) {
      this._directory = directory;
    }
    const file = this.getFile();
    if (existsSync(file)) {
      this._entries = readFileSync(file, 'utf8')
        .trim()
        .split('\n');
    } else {
      this._entries = [];
    }
    return this;
  }

  save(directory) {
    if (directory) {
      this._directory = directory;
    }
    const entries = this._entries.join('\n') + '\n';
    const file = this.getFile();
    writeFileSync(file, entries);
    return this;
  }

  add(entries) {
    this._entries = union(this._entries, entries);
    return this;
  }

  getFile() {
    return join(this._directory, '.gitignore');
  }
}

export default GitIgnore;
