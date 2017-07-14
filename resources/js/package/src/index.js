import {updatePackageFile, publishPackage, fetchNPMRegistry} from '@resdir/package-manager';
import {task, formatString, formatCode} from 'run-common';

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
      const directory = this.$getDirectory({throwIfUndefined: true});

      let files = this.files;
      if (files) {
        files = files.map(file => (file.startsWith('./') ? file.slice(2) : file));
      }

      const main = this.main.toPackageMainProperty();

      const bin = this.$get('bin').$serialize({omitName: true}); // TODO: simplify

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
      await this.$build();
      await this.$test();
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

      const pkg = await fetchNPMRegistry(this.name);
      if (this.version in pkg.versions) {
        throw new Error(
          `Can't publish over the previously published version ${formatString(
            this.version
          )}. Before publishing, use ${formatCode('version bump')} to increment the version number.`
        );
      }

      const directory = this.$getDirectory({throwIfUndefined: true});
      await publishPackage(directory, {access, debug});
    }
  };
