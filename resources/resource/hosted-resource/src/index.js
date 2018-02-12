import {printWarning, formatCode} from '@resdir/console';
import {createClientError} from '@resdir/error';

export default () => ({
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
      throw createClientError(`${formatCode('@export')} attribute not found`);
    }
    return exportResource;
  },

  getImplementationFile() {
    const exportResource = this.getExportResource();
    const implementationFile = exportResource.$getImplementationFile({considerBases: true});
    if (!implementationFile) {
      throw createClientError(`Implementation file not found`);
    }
    return implementationFile;
  },

  validate() {
    if (!this.domainName) {
      throw createClientError(`${formatCode('domainName')} attribute is missing`);
    }
  }
});
