export default base =>
  class UserOrganizations extends base {
    async list() {
      await this._getRegistry().listUserOrganizations();
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
