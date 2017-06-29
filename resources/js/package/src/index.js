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

      updatePackageFile(directory, {
        name: this.npmName || this.$name,
        version: this.$version,
        description: this.$description,
        author: this.$authors && this.$authors.length === 1 ? this.$authors[0] : undefined,
        contributors: this.$authors && this.$authors.length > 1 ? this.$authors : undefined,
        license: this.$license || 'UNLICENSED',
        repository: this.$repository,
        files: this.files,
        main: this.entries.toPackageMainProperty()
      });
    }
  };
