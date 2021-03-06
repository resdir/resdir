import {join} from 'path';
import {ensureDir, pathExists, rename} from 'fs-extra';
import {prompt, formatCode, printSuccess} from '@resdir/console';
import {validateResourceIdentifier} from '@resdir/resource-identifier';
import {validateVersion} from '@resdir/version';
import {stringifyResourceSpecifier} from '@resdir/resource-specifier';
import GitIgnore from '@resdir/gitignore-manager';
import {createClientError} from '@resdir/error';

const GIT_IGNORE = ['.DS_STORE', '/*.log'];

export default Resource => ({
  async publish({major, minor, patch, throwIfAlreadyExists, permissionToken}, environment) {
    await this.validate();

    const registryClient = await Resource.$getRegistryClient();

    if (!throwIfAlreadyExists) {
      if (major || minor || patch) {
        throw createClientError(
          `Can't disable ${formatCode('throwIfAlreadyExists')} with ${formatCode(
            'major'
          )} or ${formatCode('minor')} or ${formatCode('patch')} options`
        );
      }
      const specifier = stringifyResourceSpecifier({
        identifier: this.id,
        versionRange: this.version
      });
      const {resource} = await registryClient.resources.get({specifier, throwIfNotFound: false});
      if (resource) {
        printSuccess('Publishing aborted');
        return;
      }
    }

    await this['@build']();
    await this['@test']();

    await this.$emit('publish');

    if (major || minor || patch) {
      await this.$getChild('version').bump({major, minor, patch}, environment);
    }

    try {
      if (this.reinstallDependenciesWhilePublishing) {
        await this._startReinstallDependencies(environment);
      }
      const file = this.$getResourceFile();
      await registryClient.resources.publish({file, permissionToken}, environment);
    } finally {
      if (this.reinstallDependenciesWhilePublishing) {
        await this._completeReinstallDependencies(environment);
      }
    }

    await this.$emit('published');
  },

  async _startReinstallDependencies(environment) {
    const directory = this.$getCurrentDirectory();

    const dependencies = this.$getRoot().$getChild('dependencies');
    if (!dependencies) {
      return;
    }

    await ensureDir(join(directory, 'node_modules'));

    await rename(join(directory, 'node_modules'), join(directory, 'node_modules.original'));

    if (await pathExists(join(directory, 'node_modules.clean-install'))) {
      await rename(join(directory, 'node_modules.clean-install'), join(directory, 'node_modules'));
    }

    await dependencies.update({optimizeDiskSpace: false}, environment);
  },

  async _completeReinstallDependencies(_environment) {
    const directory = this.$getCurrentDirectory();

    if (!(await pathExists(join(directory, 'node_modules.original')))) {
      return;
    }

    if (await pathExists(join(directory, 'node_modules'))) {
      await rename(join(directory, 'node_modules'), join(directory, 'node_modules.clean-install'));
    }

    await rename(join(directory, 'node_modules.original'), join(directory, 'node_modules'));
  },

  async validate({throwIfInvalid}) {
    return (
      (await this.$getChild('id').validate({throwIfInvalid})) &&
      (await this.$getChild('version').validate({throwIfInvalid})) &&
      (await this.$getChild('keywords').validate({throwIfInvalid}))
    );
  },

  async onCreated({id, version, generateGitignore}) {
    while (!id) {
      id = await prompt('Resource identifier:');
    }
    validateResourceIdentifier(id);
    this.id = id;

    while (!version) {
      version = await prompt('Version number:', {default: '0.1.0'});
    }
    validateVersion(version);
    this.version = version;

    if (generateGitignore) {
      GitIgnore.load(this.$getCurrentDirectory())
        .add(GIT_IGNORE)
        .save();
    }

    await this.$save();
  }
});
