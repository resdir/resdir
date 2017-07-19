export default base =>
  class JSResource extends base {
    async _afterCreateJSResource() {
      console.log('_afterCreateJSResource');
    }
  };
