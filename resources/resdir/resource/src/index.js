import {prompt, formatCode, printSuccess} from '@resdir/console';
import {validateResourceIdentifier} from '@resdir/resource-identifier';
import {validateVersion} from '@resdir/version';
import {stringifyResourceSpecifier} from '@resdir/resource-specifier';
import GitIgnore from '@resdir/gitignore-manager';

const GIT_IGNORE = ['.DS_STORE', '*.log'];

export default base =>
  class ResdirResource extends base {
    async publish({major, minor, patch, throwIfAlreadyExists, permissionToken}, environment) {
      if (!(this.id && this.version)) {
        throw new Error(`Can't publish a resource without ${formatCode('id')} and ${formatCode('version')} properties`);
      }

      const registryClient = await this.constructor.$getRegistryClient();

      if (!throwIfAlreadyExists) {
        if (major || minor || patch) {
          throw new Error(`Can't disable ${formatCode('throwIfAlreadyExists')} with ${formatCode('major')} or ${formatCode('minor')} or ${formatCode('patch')} options`);
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

      const file = this.$getResourceFile();
      await registryClient.resources.publish({file, permissionToken}, environment);

      await this.$emit('published');
    }

    async initialize({id, version, gitignore}) {
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

      if (gitignore) {
        GitIgnore.load(this.$getCurrentDirectory())
          .add(GIT_IGNORE)
          .save();
      }

      await this.$save();
    }
  };
