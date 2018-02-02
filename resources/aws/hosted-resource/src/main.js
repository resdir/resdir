import {printWarning, formatCode} from '@resdir/console';

export default () => ({
  RESOURCE_ID: 'aws/hosted-resource',

  MANAGER_IDENTIFIER: 'aws-hosted-resource-v1',

  async deploy(_input, environment) {
    this.validate();
    const iamLambdaRoleHasJustBeenCreated = await this.ensureIAMLambdaRole(environment);
    await this.createOrUpdateLambdaFunction({iamLambdaRoleHasJustBeenCreated}, environment);
    await this.ensureACMCertificate(environment);
    await this.createOrUpdateAPIGateway(environment);
    await this.createOrUpdateAPIGatewayDomainName(environment);
  },

  getExportDefinition(environment) {
    const exportResource = this.getExportResource();

    const definition = {attributes: {}, methods: []};

    exportResource.$forEachChild(child => {
      const key = child.$getKey();
      const type = child.$getType();
      if (['boolean', 'number', 'string', 'array', 'object'].includes(type)) {
        definition.attributes[key] = child.$value;
      } else if (type === 'method') {
        definition.methods.push(key);
      } else {
        printWarning(
          `Attribute ${formatCode(key)} cannot be exported (only simple value attibutes and methods are currrently supported)`,
          environment
        );
      }
    });

    return definition;
  },

  getExportResource() {
    const exportResource = this.$getExport({considerBases: true});
    if (!exportResource) {
      throw new Error(`${formatCode('@export')} attribute not found`);
    }
    return exportResource;
  },

  getImplementationFile() {
    const exportResource = this.getExportResource();
    const implementationFile = exportResource.$getImplementationFile({considerBases: true});
    if (!implementationFile) {
      throw new Error(`Implementation file not found`);
    }
    return implementationFile;
  },

  validate() {
    if (!this.domainName) {
      throw new Error(`${formatCode('domainName')} property is missing`);
    }
  }
});
