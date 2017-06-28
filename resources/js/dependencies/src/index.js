import {join} from 'path';
import {omit, isEmpty, remove, sortBy, lowerCase} from 'lodash';
import {loadFile, saveFile, task, formatString} from 'run-common';

import Dependency from './dependency';
import {execNPM} from './common';

export default base =>
  class Dependencies extends base {
    constructor(definition = {}, options) {
      let dependencies = definition.packages || [];
      definition = omit(definition, 'packages');
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
      if (!dependency.version) {
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
      this._writePackageFile();
      const directory = this.$getDirectory({throwIfUndefined: true});
      await execNPM(['install'], {directory, debug});
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

    _writePackageFile() {
      const getDependencies = type => {
        const dependencies = {};
        this.forEach(dependency => {
          if (dependency.type === type) {
            dependencies[dependency.name] = dependency.version || '*';
          }
        });
        if (!isEmpty(dependencies)) {
          return dependencies;
        }
      };

      const directory = this.$getDirectory({throwIfUndefined: true});
      const file = join(directory, 'package.json');

      const pkg = loadFile(file, {throwIfNotFound: false, parse: true}) || {};

      let managedProperties = pkg.$managedProperties;
      if (!managedProperties) {
        managedProperties = {
          warning:
            'This file contains properties managed by a Resource. You should not modify them directly or by using a command such as `npm install <name>`.'
        };
      }

      const managedPropertyNames = new Set(managedProperties.name);

      pkg.dependencies = getDependencies('production');
      managedPropertyNames.add('dependencies');

      pkg.peerDependencies = getDependencies('peer');
      managedPropertyNames.add('peerDependencies');

      pkg.optionalDependencies = getDependencies('optional');
      managedPropertyNames.add('optionalDependencies');

      pkg.devDependencies = getDependencies('development');
      managedPropertyNames.add('devDependencies');

      managedProperties.names = Array.from(managedPropertyNames);
      pkg.$managedProperties = managedProperties;

      saveFile(file, pkg, {stringify: true});
    }

    static $normalize(definition, options) {
      if (Array.isArray(definition)) {
        definition = {packages: definition};
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
        definition.packages = dependencies;
      }

      const keys = Object.keys(definition);
      if (keys.length === 0) {
        definition = undefined;
      } else if (keys.length === 1 && keys[0] === 'packages') {
        definition = definition.packages;
      }

      return definition;
    }
  };
