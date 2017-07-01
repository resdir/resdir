import {omit, isEmpty, remove, sortBy, lowerCase} from 'lodash';
import {task, formatString} from 'run-common';

import Dependency from './dependency';
import {updatePackageFile, installPackage} from '@resdir/package-manager';

export default base =>
  class Dependencies extends base {
    constructor(definition = {}, options) {
      let dependencies = definition.$value || [];
      definition = omit(definition, '$value');
      super(definition, options);
      dependencies = dependencies.map(dependency => new Dependency(dependency));
      this._dependencies = dependencies;
    }

    async add(...packages) {
      const {production, development, peer, optional, verbose, quiet, debug} = packages.pop();
      let type;
      if (production) {
        type = 'production';
      } else if (development) {
        type = 'development';
      } else if (peer) {
        type = 'peer';
      } else if (optional) {
        type = 'optional';
      } else {
        type = 'production';
      }

      for (const packageIdentifier of packages) {
        const dependency = new Dependency(packageIdentifier, {type});
        await task(
          async () => {
            await this._addDependency(dependency);
            await this._updateDependencies({debug});
            this.$getRoot().$save();
          },
          {
            intro: `Adding ${formatString(dependency.name)} dependency...`,
            outro: `Dependency ${formatString(dependency.name)} added`,
            verbose,
            quiet,
            debug
          }
        );
      }
    }

    async remove(...packages) {
      const {verbose, quiet, debug} = packages.pop();

      for (const name of packages) {
        await task(
          async () => {
            this._removeDependency(name);
            await this._updateDependencies({debug});
            this.$getRoot().$save();
          },
          {
            intro: `Removing ${formatString(name)} dependency...`,
            outro: `Dependency ${formatString(name)} removed`,
            verbose,
            quiet,
            debug
          }
        );
      }
    }

    async _addDependency(dependency) {
      if (!(dependency.version || dependency.location)) {
        const latestVersion = await dependency.fetchLatestVersion();
        dependency.version = '^' + latestVersion;
      }

      this._removeDependency(dependency.name, {throwIfNotFound: false});

      this._dependencies.push(dependency);
      this._sortDependencies();
    }

    _removeDependency(name, {throwIfNotFound = true} = {}) {
      const removed = remove(this._dependencies, dep => dep.name === name);
      if (removed.length === 0 && throwIfNotFound) {
        throw new Error(`Dependency not found: ${formatString(name)}`);
      }
    }

    async _updateDependencies({debug}) {
      this._updatePackageFile();
      const directory = this.$getDirectory({throwIfUndefined: true});
      await installPackage(directory, {debug});
    }

    _sortDependencies() {
      this._dependencies = sortBy(this._dependencies, dependency => lowerCase(dependency.name));
    }

    count() {
      return this._dependencies.length;
    }

    includes(name) {
      const found = this._dependencies.find(dependency => dependency.name === name);
      return Boolean(found);
    }

    forEach(fn) {
      this._dependencies.forEach(fn);
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
      const getDependencies = type => {
        const dependencies = {};
        this.forEach(dependency => {
          if (dependency.type === type) {
            dependencies[dependency.name] = dependency.version || dependency.location || '*';
          }
        });
        if (!isEmpty(dependencies)) {
          return dependencies;
        }
      };

      const directory = this.$getDirectory({throwIfUndefined: true});

      updatePackageFile(directory, {
        dependencies: getDependencies('production'),
        peerDependencies: getDependencies('peer'),
        optionalDependencies: getDependencies('optional'),
        devDependencies: getDependencies('development')
      });
    }

    static $normalize(definition, options) {
      if (Array.isArray(definition)) {
        definition = {$value: definition};
      }
      return super.$normalize(definition, options);
    }

    $serialize(options) {
      let definition = super.$serialize(options);

      if (definition === undefined) {
        definition = {};
      }

      let dependencies = this._dependencies;
      if (dependencies.length) {
        dependencies = dependencies.map(dependency => dependency.toJSON());
        definition.$value = dependencies;
      }

      const keys = Object.keys(definition);
      if (keys.length === 0) {
        definition = undefined;
      } else if (keys.length === 1 && keys[0] === '$value') {
        definition = definition.$value;
      }

      return definition;
    }
  };
