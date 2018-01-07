import {task} from '@resdir/console';
import {ACM} from '@resdir/aws-client';
import {findACMCertificate, requestACMCertificate} from '@resdir/aws-helpers';

export default base =>
  class ACMMixin extends base {
    async ensureACMCertificate(environment) {
      await task(
        async progress => {
          const certificate = await this.getACMCertificate({throwIfNotFound: false}, environment);
          if (!certificate) {
            progress.setMessage('Creating ACM Certificate...');
            progress.setOutro('ACM Certificate created');
            await this.createACMCertificate(environment);
          }
        },
        {
          intro: `Checking ACM Certificate...`,
          outro: `ACM Certificate checked`
        },
        environment
      );
    }

    async getACMCertificate({throwIfNotFound = true} = {}, environment) {
      if (!this._acmCertificate) {
        this._acmCertificate = await findACMCertificate(
          {
            domainName: this.domainName,
            cnameAdder: this.ensureRoute53CNAME.bind(this),
            managerIdentifier: this.constructor.MANAGER_IDENTIFIER,
            acm: this.getACMClient()
          },
          environment
        );
      }

      if (!this._acmCertificate && throwIfNotFound) {
        throw new Error('ACM Certificate not found');
      }

      return this._acmCertificate;
    }

    async createACMCertificate(environment) {
      this._acmCertificate = await requestACMCertificate(
        {
          domainName: this.domainName,
          cnameAdder: this.ensureRoute53CNAME.bind(this),
          managerIdentifier: this.constructor.MANAGER_IDENTIFIER,
          acm: this.getACMClient()
        },
        environment
      );
    }

    getACMClient() {
      if (!this._acmClient) {
        this._acmClient = new ACM(this.aws);
      }
      return this._acmClient;
    }
  };
