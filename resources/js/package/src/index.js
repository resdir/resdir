import {join} from 'path';
import {isEmpty} from 'lodash';
import {saveFile} from 'run-common';

export default base =>
  class Package extends base {
    $save(...args) {
      super.$save(...args);
      this._writePackageFile();
    }

    _writePackageFile() {
      const getDependencies = type => {
        const dependencies = {};
        this.dependencies.forEach(dependency => {
          if (dependency.type === type) {
            dependencies[dependency.name] = dependency.version || '*';
          }
        });
        if (!isEmpty(dependencies)) {
          return dependencies;
        }
      };

      const pkg = {
        name: this.npmName || this.$name,
        version: this.$version,
        description: this.$description,
        author: this.$authors && this.$authors.length === 1 ? this.$authors[0] : undefined,
        contributors: this.$authors && this.$authors.length > 1 ? this.$authors : undefined,
        license: this.$license || 'UNLICENSED',
        repository: this.$repository,
        files: this.files,
        main: this.main,
        dependencies: getDependencies('production'),
        peerDependencies: getDependencies('peer'),
        optionalDependencies: getDependencies('optional'),
        devDependencies: getDependencies('development'),
        generator: {
          name: 'js/package',
          comment: 'This file is auto-generated; do not modify it directly.'
        }
      };

      const directory = this.$getDirectory({throwIfUndefined: true});
      const file = join(directory, 'package.json');
      saveFile(file, pkg, {stringify: true});
    }
  };
