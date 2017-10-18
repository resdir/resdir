export default base =>
  class UserGitHubAccount extends base {
    async connect() {
      await this._getRegistry().connectGitHubAccount();
    }

    async disconnect() {
      await this._getRegistry().disconnectGitHubAccount();
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
