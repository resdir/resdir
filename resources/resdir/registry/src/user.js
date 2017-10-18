export default base =>
  class User extends base {
    async show() {
      await this._getRegistry().showUser();
    }

    async delete() {
      await this._getRegistry().deleteUser();
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
