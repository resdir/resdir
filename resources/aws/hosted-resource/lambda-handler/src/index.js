import RemoteResourceJSONRPCHandler from '@resdir/remote-resource-json-rpc-handler';

let jsonRPCHandler;

(() => {
  const definition = require('./definition.json');

  class Base {}
  for (const key of Object.keys(definition.attributes)) {
    const value = definition.attributes[key];
    if (value !== undefined) {
      Base.prototype[key] = value;
    }
  }

  let builder = require('./builder');
  if (builder.default) {
    builder = builder.default;
  }

  const resource = new (builder(Base))();

  jsonRPCHandler = new RemoteResourceJSONRPCHandler({resource, publicMethods: definition.methods});
})();

export function handler(event, {awsRequestId}, callback) {
  jsonRPCHandler
    .handleRequest(event, {awsRequestId})
    .then(result => {
      callback(null, result);
    })
    .catch(callback);
}
