import {isEmpty, remove, sortBy, lowerCase, toPairs, fromPairs} from 'lodash';
import {print, task, formatString} from '@resdir/console';
import {
  updatePackageFile,
  removePackageFile,
  installPackage,
  updateDependencies
} from '@resdir/package-manager';

import Dependency from './dependency';

export default base =>
  class Dependencies extends base {
    async add({specifiers, production, development, peer, optional}, environment) {
      if (!specifiers) {
        throw new Error('\'specifiers\' argument is missing');
      }

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

      for (const specifier of specifiers) {
        const dependency = new Dependency(specifier, {type});
        await task(
          async () => {
            await this._addDependency(dependency);
            await this._installDependencies(undefined, environment);
            await this.$getRoot().$save();
          },
          {
            intro: `Adding ${formatString(dependency.name)} dependency...`,
            outro: `Dependency ${formatString(dependency.name)} added`
          },
          environment
        );
      }
    }

    async remove({names}, environment) {
      if (!names) {
        throw new Error('\'names\' argument is missing');
      }

      for (const name of names) {
        await task(
          async () => {
            this._removeDependency(name);
            await this._installDependencies(undefined, environment);
            await this.$getRoot().$save();
          },
          {
            intro: `Removing ${formatString(name)} dependency...`,
            outro: `Dependency ${formatString(name)} removed`
          },
          environment
        );
      }
    }

    async _addDependency(dependency) {
      if (!(dependency.version || dependency.location)) {
        const latestVersion = await dependency.fetchLatestVersion();
        dependency.version = '^' + latestVersion;
      }

      this._removeDependency(dependency.name, {throwIfNotFound: false});

      const dependencies = this._getDependencies();
      dependencies.push(dependency);
      this._setDependencies(dependencies);
    }

    _removeDependency(name, {throwIfNotFound = true} = {}) {
      const dependencies = this._getDependencies();
      const removed = remove(dependencies, dep => dep.name === name);
      if (removed.length === 0) {
        if (throwIfNotFound) {
          throw new Error(`Dependency not found: ${formatString(name)}`);
        }
        return;
      }
      this._setDependencies(dependencies);
    }

    async install(_args, environment) {
      await task(
        async () => {
          await this._installDependencies(undefined, environment);
        },
        {
          intro: `Installing dependencies...`,
          outro: `Dependencies installed`
        },
        environment
      );
    }

    async update(_args, environment) {
      await task(
        async () => {
          await this._installDependencies({updateMode: true}, environment);
        },
        {
          intro: `Updating dependencies...`,
          outro: `Dependencies updated`
        },
        environment
      );
    }

    async _installDependencies({updateMode} = {}, environment) {
      const packageDirectory = this.$getParent().$getCurrentDirectory();
      let packageFileCreated;
      try {
        const {status} = this._updatePackageFile(packageDirectory);
        packageFileCreated = status === 'CREATED';
        if (updateMode) {
          await updateDependencies(packageDirectory, undefined, environment);
        } else {
          await installPackage(packageDirectory, undefined, environment);
        }
      } finally {
        if (packageFileCreated) {
          removePackageFile(packageDirectory);
        }
      }
    }

    async count() {
      return this._getDependencies().length;
    }

    async includes({name}) {
      const found = this._getDependencies().find(dependency => dependency.name === name);
      return Boolean(found);
    }

    async list() {
      const dependencies = [];
      this.forEach(dependency => dependencies.push(dependency.toString()));
      if (dependencies.length > 0) {
        print('Dependencies:');
        for (const dependency of dependencies) {
          print('- ' + dependency);
        }
      } else {
        print('No dependencies');
      }
    }

    forEach(fn) {
      this._getDependencies().forEach(fn);
    }

    async updatePackageFile(_args, environment) {
      await task(
        async () => {
          const directory = this.$getParent().$getCurrentDirectory();
          this._updatePackageFile(directory);
        },
        {intro: `Updating package file...`, outro: `Package file updated`},
        environment
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

    _getDependencies() {
      let dependencies = this.$value || {};
      dependencies = toPairs(dependencies).map(([key, value]) =>
        Dependency.toDefinition(key, value));
      dependencies = dependencies.map(dependency => new Dependency(dependency));
      return dependencies;
    }

    _setDependencies(dependencies) {
      dependencies = sortBy(dependencies, dependency => lowerCase(dependency.name));
      if (dependencies.length === 0) {
        this.$value = undefined;
        return;
      }
      this.$value = fromPairs(dependencies.map(dependency => dependency.toPair()));
    }
  };
