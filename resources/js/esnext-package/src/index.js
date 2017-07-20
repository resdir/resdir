export default base =>
  class JSESNextPackage extends base {
    async _createJSESNextPackage() {
      await this.$setChild('main', './dist/index.js');
      await this.$save();
      await this['@build']();
    }
  };
