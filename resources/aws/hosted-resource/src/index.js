import {formatCode} from '@resdir/console';

import IAMMixin from './iam-mixin';
import LambdaMixin from './lambda-mixin';
import Route53Mixin from './route-53-mixin';
import ACMMixin from './acm-mixin';
import APIGatewayMixin from './api-gateway-mixin';

export default base =>
  class AWSHostedResource extends APIGatewayMixin(
    ACMMixin(Route53Mixin(LambdaMixin(IAMMixin(base))))
  ) {
    static RESOURCE_ID = 'aws/hosted-resource';

    static MANAGER_IDENTIFIER = 'aws-hosted-resource-v1';

    async deploy(_input, environment) {
      this.validate();
      const iamLambdaRoleHasJustBeenCreated = await this.ensureIAMLambdaRole(environment);
      await this.createOrUpdateLambdaFunction({iamLambdaRoleHasJustBeenCreated}, environment);
      await this.ensureACMCertificate(environment);
      await this.createOrUpdateAPIGateway(environment);
      await this.createOrUpdateAPIGatewayDomainName(environment);
    }

    getImplementationFile() {
      const exportResource = this.$getExport();
      if (!exportResource) {
        throw new Error(`${formatCode('@export')} attribute not found`);
      }

      const implementationFile = exportResource.$getImplementationFile();
      if (!implementationFile) {
        throw new Error(`Implementation file not found`);
      }

      return implementationFile;
    }

    validate() {
      if (!this.domainName) {
        throw new Error(`${formatCode('domainName')} property is missing`);
      }
    }
  };
