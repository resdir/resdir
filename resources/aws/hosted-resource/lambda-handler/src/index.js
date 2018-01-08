import rpc from 'easy-json-rpc';

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

export function handler(event, context, callback) {
  Promise.resolve(rpc.handleRequestAndBuildResponse(event, resource))
    .then(result => {
      callback(null, result);
    })
    .catch(callback);
}
