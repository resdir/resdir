export default base =>
  class Organizations extends base {
    async create({namespace}) {
      await this._getRegistry().createCommunity(namespace);
    }

    async delete({namespace}) {
      await this._getRegistry().deleteCommunity(namespace);
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
