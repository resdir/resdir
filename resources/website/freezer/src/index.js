import {resolve} from 'path';
import {parse as parseURL} from 'url';
import {readFile, outputFile, copy, rename, emptyDir, pathExists} from 'fs-extra';
import {task, formatCode} from '@resdir/console';
import revHash from 'rev-hash';

export default () => ({
  async run(_input, environment) {
    if (!this.sourceDirectory) {
      throw new Error(`${formatCode('sourceDirectory')} attribute is missing`);
    }

    await task(
      async () => {
        await this._copy();
        await this._freeze();
      },
      {
        intro: 'Freezing website...',
        outro: 'Website frozen'
      },
      environment
    );
  },

  async _copy() {
    if (this._getSourceDirectory() === this._getDestinationDirectory()) {
      return;
    }
    await emptyDir(this._getDestinationDirectory());
    await copy(this._getSourceDirectory(), this._getDestinationDirectory());
  },

  async _freeze() {
    // This implementation is very naive, incomplete, and ugly!
    // It should only work for simple SPA websites.
    // Only JS scripts found in entry pages are frozen.
    // You should freeze over assets (images, CSS files,...) manually.
    // For example, rename '/images/logo.svg' to '/images/logo-v1.immutable.svg'.

    // TODO:
    // - Use an HTML parser (cheerio?)
    // - Handle every tags with an URL attribute (<a>, <img>,...)
    // - Follow links to recursively freeze non-entry pages
    // - ...

    const directory = this._getDestinationDirectory();

    for (let page of this.entryPages) {
      if (!(page.endsWith('.html') || page.endsWith('.htm'))) {
        throw new Error(`Sorry, only HTML entry pages are supported`);
      }

      if (page.startsWith('/')) {
        page = page.slice(1);
      }

      const file = resolve(directory, page);
      if (!await pathExists(file)) {
        throw new Error(`Entry page not found: ${file}`);
      }

      let html = await readFile(file, 'utf8');

      let hasChanged;
      let index = 0;
      while (true) {
        const match = html.slice(index).match(/<script\s+.*src=["'](.+)["']/i);
        if (!match) {
          break;
        }

        index += match.index + 1;

        const url = match[1];

        if (parseURL(url).protocol) {
          continue; // Ignore external URLs
        }

        if (url.includes(this.hashSuffix)) {
          continue; // Ignore URLs that contains a hash
        }

        if (!url.endsWith('.js')) {
          throw new Error('Sorry, for now only .js script files are supported');
        }

        if (!url.startsWith('/')) {
          throw new Error('Sorry, relative URL are not supported yet');
        }

        const relativeURL = url.slice(1);

        const scriptFile = resolve(directory, relativeURL);
        if (!await pathExists(scriptFile)) {
          throw new Error(`Script file not found: ${scriptFile}`);
        }

        const script = await readFile(scriptFile, 'utf8');
        const hash = revHash(script) + this.hashSuffix;

        const newScriptFile = scriptFile.slice(0, -'.js'.length) + `.${hash}.js`;
        await rename(scriptFile, newScriptFile);

        const newURL = url.slice(0, -'.js'.length) + `.${hash}.js`;
        html = html.replace(url, newURL);

        hasChanged = true;
      }

      if (hasChanged) {
        await outputFile(file, html);
      }
    }
  },

  _getSourceDirectory() {
    return resolve(this.$getCurrentDirectory(), this.sourceDirectory);
  },

  _getDestinationDirectory() {
    if (this.destinationDirectory) {
      return resolve(this.$getCurrentDirectory(), this.destinationDirectory);
    }
    return this._getSourceDirectory();
  }
});
