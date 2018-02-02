import {resolve} from 'path';
import {isPlainObject, isEmpty, entries} from 'lodash';
import {readFile, outputFile, copy, emptyDir, pathExists} from 'fs-extra';
import isDirectory from 'is-directory';
import {task, formatCode} from '@resdir/console';

export default () => ({
  async run(_input, environment) {
    if (!this.destinationDirectory) {
      throw new Error(`${formatCode('destinationDirectory')} attribute is missing`);
    }

    if (!this.files) {
      throw new Error(`${formatCode('files')} attribute is missing`);
    }

    await task(
      async () => {
        if (this.clearDestination) {
          await this._clearDestination();
        }
        await this._copyFiles();
      },
      {
        intro: 'Copying files...',
        outro: 'Files copied'
      },
      environment
    );
  },

  async _copyFiles() {
    const sourceDirectory = this._getSourceDirectory();
    const destinationDirectory = this._getDestinationDirectory();

    for (let entry of this.files) {
      if (typeof entry === 'string') {
        entry = {source: entry};
      }
      if (!isPlainObject(entry)) {
        throw new Error(`${formatCode('files')} entries must be a string or a plain object`);
      }
      if (entry.source === undefined) {
        throw new Error(`${formatCode('source')} is missing in a ${formatCode('files')} entry`);
      }
      if (entry.destination === undefined) {
        entry = {...entry, destination: entry.source};
      }
      if (entry.replacements === undefined) {
        entry = {...entry, replacements: {}};
      }
      if (!isPlainObject(entry.replacements)) {
        throw new Error(`${formatCode('replacements')} in ${formatCode('files')} must be plain object`);
      }

      const source = resolve(sourceDirectory, entry.source);
      const destination = resolve(destinationDirectory, entry.destination);

      if (!await pathExists(source)) {
        throw new Error(`There is nothing at the following path: ${source}`);
      }

      if (isDirectory.sync(source)) {
        if (!isEmpty(entry.replacements)) {
          throw new Error(`Sorry, the ${formatCode('replacements')} attribute only works with file sources (directory are not supported yet)`);
        }
        await copy(source, destination);
      } else {
        let data = await readFile(source, 'utf8');
        data = _replace(data, entry.replacements);
        await outputFile(destination, data);
      }
    }
  },

  async _clearDestination() {
    const sourceDirectory = this._getSourceDirectory();
    const destinationDirectory = this._getDestinationDirectory();
    if (sourceDirectory === destinationDirectory) {
      throw new Error(`${formatCode('sourceDirectory')} and ${formatCode('destinationDirectory')} cannot be identical`);
    }
    await emptyDir(destinationDirectory);
  },

  _getSourceDirectory() {
    return resolve(this.$getCurrentDirectory(), this.sourceDirectory);
  },

  _getDestinationDirectory() {
    return resolve(this.$getCurrentDirectory(), this.destinationDirectory);
  }
});

function _replace(data, replacements = {}) {
  for (const [key, value] of entries(replacements)) {
    // TODO: handle replacement of multiple occurences
    data = data.replace(key, value);
  }
  return data;
}
