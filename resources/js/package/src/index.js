import {join} from 'path';
import {outputFileSync} from 'fs-extra';
import {updatePackageFile, publishPackage, fetchNPMRegistry} from '@resdir/package-manager';
import {task, formatString, formatCode} from '@resdir/console';

const PACKAGE_CODE = `// Package implementation
`;

export default base =>
  class Package extends base {
    async updatePackageFile({verbose, quiet, debug}) {
      await task(
        async () => {
          this._updatePackageFile();
          await this.dependencies.updatePackageFile({quiet: true});
        },
        {intro: `Updating package file...`, outro: `Package file updated`, verbose, quiet, debug}
      );
    }

    _updatePackageFile() {
      const directory = this.$getCurrentDirectory();

      let files = this.files;
      if (files) {
        files = files.map(file => (file.startsWith('./') ? file.slice(2) : file));
      }

      const main = this.main.toPackageMainProperty();

      const bin = this.$getChild('bin').$serialize(); // TODO: simplify

      updatePackageFile(directory, {
        name: this.name,
        version: this.version,
        description: this.description,
        author: this.author,
        contributors: this.contributors,
        license: this.license,
        repository: this.repository,
        files,
        main,
        bin,
        preferGlobal: this.preferGlobal
      });
    }

    async publish({access, verbose, quiet, debug}) {
      await this['@build']();
      await this['@test']();
      await task(
        async () => {
          await this._publish({access, debug});
        },
        {
          intro: `Publishing package...`,
          outro: `Package published`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async _publish({access, debug}) {
      if (!this.name) {
        throw new Error(`${formatCode('name')} property is missing`);
      }
      if (!this.version) {
        throw new Error(`${formatCode('version')} property is missing`);
      }
      if (!this.description) {
        throw new Error(`${formatCode('description')} property is missing`);
      }

      const pkg = await fetchNPMRegistry(this.name, {throwIfNotFound: false});
      if (pkg && this.version in pkg.versions) {
        throw new Error(
          `Can't publish over the previously published version ${formatString(
            this.version
          )}. Before publishing, use ${formatCode('version bump')} to increment the version number.`
        );
      }

      const directory = this.$getCurrentDirectory();
      await publishPackage(directory, {access, debug});
    }

    async _createJSPackage() {
      const directory = this.$getCurrentDirectory();
      const file = join(directory, 'src', 'index.js');
      outputFileSync(file, PACKAGE_CODE);
      this.name = this.$name;
      this.$name = undefined;
      this.version = this.$version.toString();
      this.$version = undefined;
      this.files = ['./src'];
      await this.$setChild('main', './src/index.js');
      await this.$save();
    }
  };
