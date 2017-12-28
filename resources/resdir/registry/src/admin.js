export default base =>
  class Admin extends base {
    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
