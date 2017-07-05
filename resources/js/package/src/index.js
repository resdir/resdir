import {updatePackageFile} from '@resdir/package-manager';
import {task} from 'run-common';

export default base =>
  class Package extends base {
    $save(...args) {
      super.$save(...args);
      this._updatePackageFile();
    }

    updatePackageFile() {
      task(
        () => {
          this._updatePackageFile();
        },
        {intro: `Updating package file...`, outro: `Package file updated`}
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
        name: this.name || this.$name,
        version: this.version || this.$version,
        description: this.description || this.$description,
        author:
          this.author ||
          (this.$authors && this.$authors.length === 1 ? this.$authors[0] : undefined),
        contributors:
          this.contributors ||
          (this.$authors && this.$authors.length > 1 ? this.$authors : undefined),
        license: this.license || this.$license || 'UNLICENSED',
        repository: this.repository || this.$repository,
        files,
        main,
        bin,
        preferGlobal: this.preferGlobal
      });
    }
  };
