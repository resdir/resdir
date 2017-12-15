import {task, prompt, formatString, formatCode} from '@resdir/console';
import RegistryClient from '@resdir/registry-client';
import {validateResourceIdentifier} from '@resdir/resource-identifier';
import {validateVersion} from '@resdir/version';
import GitIgnore from '@resdir/gitignore-manager';

const GIT_IGNORE = ['.DS_STORE', '*.log'];

export default base =>
  class ResdirResource extends base {
    async publish({major, minor, patch}, environment) {
      if (!(this.id && this.version)) {
        throw new Error(`Can't publish a resource without ${formatCode('id')} and ${formatCode('version')} properties`);
      }

      await this['@build']();
      await this['@test']();

      await this.$emit('publish');

      if (major || minor || patch) {
        await this.$getChild('version').bump({major, minor, patch}, environment);
      }

      await task(
        async () => {
          const definition = this.$serialize({publishing: true});
          const directory = this.$getCurrentDirectory();
          await this._getRegistry().publishResource(definition, directory);
        },
        {
          intro: `Publishing resource (${formatString(this.id)})...`,
          outro: `Resource published (${formatString(this.id)})`
        },
        environment
      );

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

    _getRegistry() {
      if (!this._registry) {
        this._registry = new RegistryClient({
          registryURL: process.env.RESDIR_REGISTRY_URL,
          clientId: this.$getClientId(),
          clientDirectory: this.$getClientDirectory(),
          awsRegion: process.env.RESDIR_REGISTRY_AWS_REGION,
          awsS3BucketName: process.env.RESDIR_REGISTRY_AWS_S3_BUCKET_NAME,
          awsS3ResourceUploadsPrefix: process.env.RESDIR_REGISTRY_AWS_S3_RESOURCE_UPLOADS_PREFIX
        });
      }
      return this._registry;
    }
  };
