import {RemoteResource} from 'run-core/dist/esm/resource/remote';
import RemoteResourceJSONRPCHandler from '@resdir/remote-resource-json-rpc-handler';

let jsonRPCHandler;

(() => {
  const definition = require('./definition.json');

  let builder = require('./builder');
  if (builder.default) {
    builder = builder.default;
  }

  const implementation = builder(RemoteResource);

  const resource = {...definition.attributes, ...implementation};

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
