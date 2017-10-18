import RegistryClient from '@resdir/registry-client';

export default base =>
  class ResdirRegistry extends base {
    async signUp({email}) {
      await this._getRegistry().signUp(email);
    }

    async signIn({email}) {
      await this._getRegistry().signIn(email);
    }

    async signOut() {
      await this._getRegistry().signOut();
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
