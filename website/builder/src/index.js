import {join, resolve} from 'path';
import {entries} from 'lodash';
import {readFile, outputFile, emptyDir, copy} from 'fs-extra';
import {task} from '@resdir/console';
import revHash from 'rev-hash';

export default base =>
  class Builder extends base {
    async run(_input, environment) {
      await task(
        async () => {
          await this.clearDestination();
          const bundleFilename = await this.copyBundle();
          await this.copyIndexPage({bundleFilename});
          await this.copyAssets();
        },
        {
          intro: 'Building website...',
          outro: 'Website built'
        },
        environment
      );
    }

    async clearDestination() {
      await emptyDir(this.getDestinationDirectory());
    }

    async copyBundle() {
      let data = await readFile(join(this.getSourceDirectory(), this.bundleFile), 'utf8');
      data = replace(data, this.replacements);
      const hash = revHash(data);
      const bundleFilename = `bundle.${hash}.immutable.js`;
      await outputFile(join(this.getDestinationDirectory(), bundleFilename), data);
      return bundleFilename;
    }

    async copyIndexPage({bundleFilename}) {
      let data = await readFile(join(this.getSourceDirectory(), 'index.html'), 'utf8');
      data = replace(data, {...this.replacements, $BUNDLE_PATH$: '/' + bundleFilename});
      await outputFile(join(this.getDestinationDirectory(), 'index.html'), data);
    }

    async copyAssets() {
      await copy(
        join(this.getSourceDirectory(), 'images'),
        join(this.getDestinationDirectory(), 'images')
      );
    }

    getSourceDirectory() {
      return resolve(this.$getCurrentDirectory(), this.sourceDirectory);
    }

    getDestinationDirectory() {
      return resolve(this.$getCurrentDirectory(), this.destinationDirectory);
    }
  };

function replace(data, replacements = {}) {
  for (const [key, value] of entries(replacements)) {
    // TODO: handle replacement of multiple occurences
    data = data.replace(key, value);
  }
  return data;
}
