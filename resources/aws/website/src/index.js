import {S3} from '@resdir/aws-client';

export default base =>
  class extends base {
    async deploy() {
      await this.ensureBucket();
    }

    async ensureBucket() {}

    getS3Client() {
      if (!this._s3Client) {
        this._s3Client = new S3(this.aws);
      }
      return this._s3Client;
    }
  };
