export default base =>
  class Organizations extends base {
    async create({namespace, permissionToken}) {
      await this._getRegistry().createCommunity(namespace, {permissionToken});
    }

    async delete({namespace}) {
      await this._getRegistry().deleteCommunity(namespace);
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
