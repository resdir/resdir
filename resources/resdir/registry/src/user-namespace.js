export default base =>
  class UserNamespace extends base {
    async add({namespace}) {
      await this._getRegistry().addUserNamespace(namespace);
    }

    async remove() {
      await this._getRegistry().removeUserNamespace();
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
