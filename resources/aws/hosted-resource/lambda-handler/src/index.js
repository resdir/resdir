import {
  validateJSONRPCRequest,
  buildJSONRPCResult,
  buildJSONRPCError,
  createJSONRPCError
} from '@resdir/json-rpc';

const Base = (() => {
  const definition = require('./definition.json');

  class Base {
    __getMethods__() {
      return definition.methods;
    }
  }

  for (const key of Object.keys(definition.attributes)) {
    const value = definition.attributes[key];
    if (value !== undefined) {
      Base.prototype[key] = value;
    }
  }

  return Base;
})();

const resource = (() => {
  return new (require('./builder')(Base))();
})();

async function handleJSONRPCRequest(request) {
  try {
    validateJSONRPCRequest(request);

    if (
      !(request.method === '__getMethods__' || resource.__getMethods__().includes(request.method))
    ) {
      throw createJSONRPCError(-32601);
    }

    const {input, environment} = request.params || {};

    const fn = resource[request.method];
    const result = await fn.call(resource, input, environment);

    return buildJSONRPCResult(request.id, result);
  } catch (err) {
    let exposedError = err;
    if (!(err.jsonRPCErrorCode || err.expose)) {
      console.log('[ERROR] ' + err.message);
      exposedError = new Error('An error occurred while running a resource method remotely');
    }
    return buildJSONRPCError(request.id, exposedError);
  }
}

export function handler(event, context, callback) {
  handleJSONRPCRequest(event)
    .then(result => {
      callback(null, result);
    })
    .catch(callback);
}
