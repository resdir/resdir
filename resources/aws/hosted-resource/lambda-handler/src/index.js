import {
  validateJSONRPCRequest,
  buildJSONRPCResult,
  buildJSONRPCError,
  createJSONRPCError
} from '@resdir/json-rpc';

class Base {
  __getMethods__() {
    if (!this.__methods__) {
      this.__methods__ = [];
      const prototype = Object.getPrototypeOf(this);
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === 'constructor') {
          continue;
        }
        if (typeof prototype[name] !== 'function') {
          continue;
        }
        this.__methods__.push(name);
      }
    }
    return this.__methods__;
  }
}

const resource = (() => {
  return new (require('./builder')(Base))();
})();

async function handleJSONRPCRequest(request) {
  try {
    validateJSONRPCRequest(request);

    const fn = resource[request.method];
    if (typeof fn !== 'function') {
      throw createJSONRPCError(-32601);
    }

    const {input, environment} = request.params || {};

    const result = await fn.call(resource, input, environment);

    return buildJSONRPCResult(request.id, result);
  } catch (err) {
    return buildJSONRPCError(request.id, err);
  }
}

export function handler(event, context, callback) {
  handleJSONRPCRequest(event)
    .then(result => {
      callback(null, result);
    })
    .catch(callback);
}
