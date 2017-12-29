export default base =>
  class UserNamespace extends base {
    async create({namespace, permissionToken}) {
      await this._getRegistry().createUserNamespace(namespace, {permissionToken});
    }

    async delete() {
      await this._getRegistry().deleteUserNamespace();
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
