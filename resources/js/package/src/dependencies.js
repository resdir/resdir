import {remove, sortBy, lowerCase} from 'lodash';
import {task, formatString} from 'run-common';

import Dependency from './dependency';
import {execNPM} from './common';

export default base =>
  class Dependencies extends base {
    constructor(definition, options) {
      super(definition, options);
      let dependencies = definition.$value || [];
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
        const {name} = Dependency.parsePackageIdentifier(packageIdentifier);
        await task(
          async () => {
            const definition = {package: packageIdentifier, type};
            await this._addDependency(definition);
            await this._updateDependencies({debug});
            this.$getParent().$save();
          },
          {
            intro: `Adding ${formatString(name)} dependency...`,
            outro: `Dependency ${formatString(name)} added`,
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
            this.$getParent().$save();
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

    async _addDependency(definition) {
      const dependency = new Dependency(definition);

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
      this.$getParent()._writePackageFile();
      const directory = this.$getParent().$getDirectory({throwIfUndefined: true});
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
