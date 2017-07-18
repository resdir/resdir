module.exports = base =>
  class JSResource extends base {
    async _afterCreateJSResource() {
      console.log('_afterCreateJSResource');
    }
  };
