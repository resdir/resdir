export default base =>
  class JSESNextResource extends base {
    async _afterCreateJSESNextResource() {
      console.log('_afterCreateJSESNextResource');
    }
  };
