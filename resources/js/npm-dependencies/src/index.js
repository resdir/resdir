import {isEmpty, remove, sortBy, lowerCase, toPairs, fromPairs} from 'lodash';
import {
  print,
  printText,
  task,
  confirm,
  formatString,
  formatPath,
  formatBold,
  formatPunctuation,
  formatURL,
  formatDanger,
  emptyLine
} from '@resdir/console';
import {createClientError} from '@resdir/error';
import {
  updatePackageFile,
  installPackage,
  updateDependencies,
  getCurrentDependencyVersion
} from '@resdir/package-manager';
import GitIgnore from '@resdir/gitignore-manager';

import Dependency from './dependency';

const GIT_IGNORE = ['/node_modules'];

export default () => ({
  async add({specifiers, production, development, peer, optional, optimizeDiskSpace}, environment) {
    if (!specifiers) {
      throw new Error("'specifiers' argument is missing");
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
          await this._installDependencies({optimizeDiskSpace}, environment);
          await this.$getRoot().$save();
        },
        {
          intro: `Adding ${formatString(dependency.name)} dependency...`,
          outro: `Dependency ${formatString(dependency.name)} added`
        },
        environment
      );
    }
  },

  async remove({names, optimizeDiskSpace}, environment) {
    if (!names) {
      throw new Error("'names' argument is missing");
    }

    for (const name of names) {
      await task(
        async () => {
          this._removeDependency(name);
          await this._installDependencies({optimizeDiskSpace}, environment);
          await this.$getRoot().$save();
        },
        {
          intro: `Removing ${formatString(name)} dependency...`,
          outro: `Dependency ${formatString(name)} removed`
        },
        environment
      );
    }
  },

  async _addDependency(dependency) {
    if (!(dependency.version || dependency.location)) {
      const {latestVersion} = await dependency.fetchLatestVersion();
      dependency.version = '^' + latestVersion;
    }

    this._removeDependency(dependency.name, {throwIfNotFound: false});

    const dependencies = this._getDependencies();
    dependencies.push(dependency);
    this._setDependencies(dependencies);
  },

  _removeDependency(name, {throwIfNotFound = true} = {}) {
    const dependencies = this._getDependencies();
    const removed = remove(dependencies, dep => dep.name === name);
    if (removed.length === 0) {
      if (throwIfNotFound) {
        throw createClientError(`Dependency not found: ${formatString(name)}`);
      }
      return;
    }
    this._setDependencies(dependencies);
  },

  async install({optimizeDiskSpace}, environment) {
    await task(
      async () => {
        await this._installDependencies({optimizeDiskSpace}, environment);
      },
      {
        intro: `Installing dependencies...`,
        outro: `Dependencies installed (${formatPath(this._getResourceDirectory(), {
          baseDirectory: './',
          relativize: true
        })})`
      },
      environment
    );
  },

  async update({optimizeDiskSpace}, environment) {
    await task(
      async () => {
        await this._installDependencies({updateMode: true, optimizeDiskSpace}, environment);
      },
      {
        intro: `Updating dependencies...`,
        outro: `Dependencies updated`
      },
      environment
    );
  },

  async upgrade({names, optimizeDiskSpace}, environment) {
    if (names) {
      for (const name of names) {
        if (!(await this.includes({name}, environment))) {
          throw createClientError(`No such dependency: ${formatString(name)}`);
        }
      }
    }

    const directory = this._getResourceDirectory();

    const outdatedDependencies = [];

    await task(
      async progress => {
        await this.forEach(async dependency => {
          const {name, type} = dependency;
          if (names && !names.includes(name)) {
            return;
          }
          if (dependency.location) {
            return;
          }
          const {latestVersion, gitHubURL} = await dependency.fetchLatestVersion();
          if (!dependency.version.includes(latestVersion)) {
            const currentVersion = await getCurrentDependencyVersion(directory, name, {
              throwIfNotFound: false
            });
            outdatedDependencies.push({name, currentVersion, latestVersion, gitHubURL, type});
          }
        });

        if (!outdatedDependencies.length) {
          progress.setOutro('No upgrade is necessary');
        }
      },
      {
        intro: `Checking dependencies...`,
        outro: `Dependencies checked`
      },
      environment
    );

    if (!outdatedDependencies.length) {
      return;
    }

    emptyLine();
    print('The following upgrades are available:');
    emptyLine();
    for (const {name, currentVersion, latestVersion, gitHubURL} of outdatedDependencies) {
      let line = `- ${formatString(name, {addQuotes: false})}${formatPunctuation(
        ':'
      )} ${currentVersion} ${formatPunctuation('=>')} ${formatBold(latestVersion)}`;
      if (gitHubURL) {
        line += ` ${formatPunctuation('(')}${formatURL(gitHubURL)}${formatPunctuation(')')}`;
      }
      print(line);
    }

    emptyLine();
    printText(
      `Some of these upgrades may contain ${formatDanger(
        'breaking changes'
      )}, you should check the changelogs before upgrading.`
    );
    emptyLine();
    const ready = await confirm(`Ready to upgrade?`, {default: true});
    emptyLine();
    if (!ready) {
      throw createClientError('Upgrade aborted');
    }

    for (const {name, latestVersion, type} of outdatedDependencies) {
      const specifier = `${name}@^${latestVersion}`;
      const dependency = new Dependency(specifier, {type});
      await task(
        async () => {
          await this._addDependency(dependency);
          await this._installDependencies({optimizeDiskSpace}, environment);
          await this.$getRoot().$save();
        },
        {
          intro: `Upgrading ${formatString(dependency.name)} dependency...`,
          outro: `Dependency ${formatString(dependency.name)} upgraded`
        },
        environment
      );
    }
  },

  async _installDependencies({updateMode, optimizeDiskSpace} = {}, environment) {
    const packageDirectory = this._getResourceDirectory();
    await this._updatePackageFile(packageDirectory);
    const clientDirectory = this.$getClientDirectory();
    if (updateMode) {
      await updateDependencies(packageDirectory, {optimizeDiskSpace, clientDirectory}, environment);
    } else {
      await installPackage(packageDirectory, {optimizeDiskSpace, clientDirectory}, environment);
    }
  },

  async count() {
    return this._getDependencies().length;
  },

  async includes({name}, _environment) {
    const found = this._getDependencies().find(dependency => dependency.name === name);
    return Boolean(found);
  },

  async list() {
    const dependencies = [];
    await this.forEach(dependency => dependencies.push(dependency.toString()));
    if (dependencies.length > 0) {
      print('Dependencies:');
      for (const dependency of dependencies) {
        print('- ' + dependency);
      }
    } else {
      print('No dependencies');
    }
  },

  async forEach(fn) {
    const dependencies = this._getDependencies();
    for (const dependency of dependencies) {
      await fn(dependency);
    }
  },

  async updatePackageFile(_args, environment) {
    await task(
      async () => {
        const directory = this._getResourceDirectory();
        await this._updatePackageFile(directory);
      },
      {intro: `Updating package file...`, outro: `Package file updated`},
      environment
    );
  },

  async _updatePackageFile(directory) {
    const getDependencies = async type => {
      const dependencies = {};
      await this.forEach(dependency => {
        if (dependency.type === type) {
          dependencies[dependency.name] = dependency.version || dependency.location || '*';
        }
      });
      if (!isEmpty(dependencies)) {
        return dependencies;
      }
    };

    return updatePackageFile(directory, {
      dependencies: await getDependencies('production'),
      peerDependencies: await getDependencies('peer'),
      optionalDependencies: await getDependencies('optional'),
      devDependencies: await getDependencies('development')
    });
  },

  _getResourceDirectory() {
    return this.$getParent().$getCurrentDirectory();
  },

  _getDependencies() {
    let dependencies = this.$value || {};
    dependencies = toPairs(dependencies).map(([key, value]) => Dependency.toDefinition(key, value));
    dependencies = dependencies.map(dependency => new Dependency(dependency));
    return dependencies;
  },

  _setDependencies(dependencies) {
    dependencies = sortBy(dependencies, dependency => lowerCase(dependency.name));
    if (dependencies.length === 0) {
      this.$value = undefined;
      return;
    }
    this.$value = fromPairs(dependencies.map(dependency => dependency.toPair()));
  },

  async onCreated({generateGitignore}) {
    if (this.$isRoot()) {
      // This creation method works only with child properties
      return;
    }

    const root = this.$getRoot();
    const directory = root.$getCurrentDirectory();

    if (generateGitignore) {
      GitIgnore.load(directory)
        .add(GIT_IGNORE)
        .save();
    }
  }
});
