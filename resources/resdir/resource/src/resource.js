import {task, formatString, formatCode} from '@resdir/console';
import RegistryClient from '@resdir/registry-client';

export default base =>
  class ResdirResource extends base {
    async publish({major, minor, patch}) {
      await this.$emitEvent('before:publish');

      if (!(this.id && this.version)) {
        throw new Error(
          `Can't publish a resource without ${formatCode('id')} and ${formatCode(
            'version'
          )} properties`
        );
      }

      if (major || minor || patch) {
        await this.$getChild('version').bump({major, minor, patch});
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
        }
      );

      await this.$emitEvent('after:publish');
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
