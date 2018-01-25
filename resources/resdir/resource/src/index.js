import {prompt, formatCode} from '@resdir/console';
import {validateResourceIdentifier} from '@resdir/resource-identifier';
import {validateVersion} from '@resdir/version';
import GitIgnore from '@resdir/gitignore-manager';

const GIT_IGNORE = ['.DS_STORE', '*.log'];

export default base =>
  class ResdirResource extends base {
    async publish({major, minor, patch, permissionToken}, environment) {
      if (!(this.id && this.version)) {
        throw new Error(`Can't publish a resource without ${formatCode('id')} and ${formatCode('version')} properties`);
      }

      await this['@build']();
      await this['@test']();

      await this.$emit('publish');

      if (major || minor || patch) {
        await this.$getChild('version').bump({major, minor, patch}, environment);
      }

      const registryClient = await this.constructor.$getRegistryClient();
      const file = this.$getResourceFile();
      await registryClient.resources.publish({file, permissionToken});

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
