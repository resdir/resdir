import {
  validateJSONRPCRequest,
  buildJSONRPCResult,
  buildJSONRPCError,
  createJSONRPCError
} from '@resdir/json-rpc';
import {createClientError, isClientError} from '@resdir/error';

let definition;

const Base = (() => {
  definition = require('./definition.json');
  class Base {}
  for (const key of Object.keys(definition.attributes)) {
    const value = definition.attributes[key];
    if (value !== undefined) {
      Base.prototype[key] = value;
    }
  }
  return Base;
})();

const resource = (() => {
  let builder = require('./builder');
  if (builder.default) {
    builder = builder.default;
  }
  return new (builder(Base))();
})();

async function handleJSONRPCRequest(request, {awsRequestId}) {
  try {
    validateJSONRPCRequest(request);

    let result;

    if (request.method === 'invokeMethod') {
      const {name, input, environment} = request.params || {};
      if (!name) {
        throw createClientError(`Method name is missing`);
      }
      if (definition.methods.includes(name)) {
        const output = await resource[name](input, environment);
        result = {output};
      } else {
        throw createClientError(`Remote method '${name}' doesn't exist`);
      }
    } else if (request.method === 'getMethods') {
      result = definition.methods;
    } else {
      throw createJSONRPCError(-32601);
    }

    return buildJSONRPCResult(request.id, result);
  } catch (err) {
    let exposedError = err;
    if (!(err.jsonRPCErrorCode || isClientError(err))) {
      console.log('[ERROR] ' + (err.stack || err.message).replace(/\n/g, ' '));
      exposedError = new Error(`An error occurred while running a resource method remotely (awsRequestId: '${awsRequestId}')`);
    }
    return buildJSONRPCError(request.id, exposedError);
  }
}

export function handler(event, {awsRequestId}, callback) {
  handleJSONRPCRequest(event, {awsRequestId})
    .then(result => {
      callback(null, result);
    })
    .catch(callback);
}
