import {
  validateJSONRPCRequest,
  buildJSONRPCResult,
  buildJSONRPCError,
  createJSONRPCError
} from '@resdir/json-rpc';
import {createClientError, isClientError, isServerError} from '@resdir/error';

const INVOKE_METHOD_VERSION = 1;

export class RemoteResourceJSONRPCHandler {
  constructor({resource, publicMethods}) {
    this.resource = resource;
    this.publicMethods = publicMethods;
  }

  async handleRequest(request, {awsRequestId} = {}) {
    try {
      validateJSONRPCRequest(request);

      if (request.method !== 'invoke') {
        throw createJSONRPCError(-32601);
      }

      const {name, input, environment, version} = request.params || {};

      if (!name) {
        throw createClientError(`Method name is missing`);
      }

      if (version === undefined) {
        throw createClientError(`'invoke' method version is missing`);
      }

      if (version !== INVOKE_METHOD_VERSION) {
        throw createClientError(`'invoke' method version ${version} is unsupported`);
      }

      if (!this.publicMethods.includes(name)) {
        throw createClientError(`Remote method '${name}' doesn't exist`);
      }

      let output = await this.resource[name](input, environment);

      if (output && output.$serialize) {
        output = output.$serialize();
      }

      return buildJSONRPCResult(request.id, {output});
    } catch (err) {
      let exposedError = err;

      if (!(err.jsonRPCErrorCode || isClientError(err) || isServerError(err))) {
        if (awsRequestId) {
          let message = err.stack || err.message;
          message = message.replace(/\s+/g, ' ');
          message = message.trim();
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
