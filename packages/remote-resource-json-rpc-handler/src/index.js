import {
  validateJSONRPCRequest,
  buildJSONRPCResult,
  buildJSONRPCError,
  createJSONRPCError
} from '@resdir/json-rpc';
import {createClientError, isClientError} from '@resdir/error';

export class RemoteResourceJSONRPCHandler {
  constructor({resource, publicMethods}) {
    this.resource = resource;
    this.publicMethods = publicMethods;
  }

  async handleRequest(request, {awsRequestId} = {}) {
    try {
      validateJSONRPCRequest(request);

      let result;

      if (request.method === 'invokeMethod') {
        const {name, input, environment} = request.params || {};
        if (!name) {
          throw createClientError(`Method name is missing`);
        }
        if (this.publicMethods.includes(name)) {
          let output = await this.resource[name](input, environment);
          if (output && output.$serialize) {
            output = output.$serialize();
          }
          result = {output};
        } else {
          throw createClientError(`Remote method '${name}' doesn't exist`);
        }
      } else if (request.method === 'getMethods') {
        result = this.publicMethods;
      } else {
        throw createJSONRPCError(-32601);
      }

      return buildJSONRPCResult(request.id, result);
    } catch (err) {
      let exposedError = err;
      if (!(err.jsonRPCErrorCode || isClientError(err))) {
        if (awsRequestId) {
          let message = err.stack || err.message;
          message = message.replace(/\n/g, ' ');
          console.log('[ERROR] ' + message);
        } else {
          console.error(err);
        }
        let exposedMessage = 'An error occurred while running a resource method remotely';
        if (awsRequestId) {
          exposedMessage += ` (awsRequestId: '${awsRequestId}')`;
        }
        exposedError = createJSONRPCError(-1, exposedMessage);
      }
      return buildJSONRPCError(request.id, exposedError);
    }
  }
}

export default RemoteResourceJSONRPCHandler;
