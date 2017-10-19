import {omit, isEmpty, remove, sortBy, lowerCase} from 'lodash';
import {task, formatString} from '@resdir/console';
import {updatePackageFile, removePackageFile, installPackage} from '@resdir/package-manager';

import Dependency from './dependency';

export default base =>
  class Dependencies extends base {
    async $construct(definition = {}, options) {
      let dependencies = definition['@value'] || [];
      definition = omit(definition, '@value');
      await super.$construct(definition, options);
      dependencies = dependencies.map(dependency => new Dependency(dependency));
      this._dependencies = dependencies;
    }

    async add({specifier, production, development, peer, optional}, {verbose, quiet, debug}) {
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

      const specifiers = [];
      if (specifier) {
        specifiers.push(specifier); // TODO: Handle multiple packages
      }

      for (const specifier of specifiers) {
        const dependency = new Dependency(specifier, {type});
        await task(
          async () => {
            await this._addDependency(dependency);
            await this._installDependencies({debug});
            await this.$getRoot().$save();
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

    async remove({name}, {verbose, quiet, debug}) {
      const names = [];
      if (name) {
        names.push(name); // TODO: Handle multiple packages
      }

      for (const name of names) {
        await task(
          async () => {
            this._removeDependency(name);
            await this._installDependencies({debug});
            await this.$getRoot().$save();
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

    async install(_args, {verbose, quiet, debug}) {
      await task(
        async () => {
          await this._installDependencies();
        },
        {
          intro: `Installing dependencies...`,
          outro: `Dependencies installed`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async _installDependencies({debug} = {}) {
      const packageDirectory = this.$getParent().$getCurrentDirectory();
      let packageFileCreated;
      try {
        const {status} = this._updatePackageFile(packageDirectory);
        packageFileCreated = status === 'CREATED';
        await installPackage(packageDirectory, {debug});
      } finally {
        if (packageFileCreated) {
          removePackageFile(packageDirectory);
        }
      }
    }

    _sortDependencies() {
      this._dependencies = sortBy(this._dependencies, dependency => lowerCase(dependency.name));
    }

    async count() {
      return this._dependencies.length;
    }

    async includes({name}) {
      const found = this._dependencies.find(dependency => dependency.name === name);
      return Boolean(found);
    }

    forEach(fn) {
      this._dependencies.forEach(fn);
    }

    async updatePackageFile(_args, {verbose, quiet, debug}) {
      await task(
        async () => {
          const directory = this.$getParent().$getCurrentDirectory();
          this._updatePackageFile(directory);
        },
        {intro: `Updating package file...`, outro: `Package file updated`, verbose, quiet, debug}
      );
    }

    _updatePackageFile(directory) {
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

      return updatePackageFile(directory, {
        dependencies: getDependencies('production'),
        peerDependencies: getDependencies('peer'),
        optionalDependencies: getDependencies('optional'),
        devDependencies: getDependencies('development')
      });
    }

    static $normalize(definition, options) {
      if (Array.isArray(definition)) {
        definition = {'@value': definition};
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
        definition['@value'] = dependencies;
      }

      const keys = Object.keys(definition);
      if (keys.length === 0) {
        definition = undefined;
      } else if (keys.length === 1 && keys[0] === '@value') {
        definition = definition['@value'];
      }

      return definition;
    }
  };
