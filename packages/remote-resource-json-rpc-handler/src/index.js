import {
  validateJSONRPCRequest,
  buildJSONRPCResult,
  buildJSONRPCError,
  createJSONRPCError
} from '@resdir/json-rpc';
import {createClientError, isClientError, isServerError} from '@resdir/error';

const GET_METHODS_METHOD_VERSION = 1;
const INVOKE_METHOD_VERSION = 1;

export class RemoteResourceJSONRPCHandler {
  constructor({resource, publicMethods}) {
    this.resource = resource;
    this.publicMethods = publicMethods;
  }

  async handleRequest(request, {awsRequestId} = {}) {
    try {
      validateJSONRPCRequest(request);

      let result;

      if (request.method === 'getMethods') {
        result = await this.handleGetMethodsRequest(request.params);
      } else if (request.method === 'invoke') {
        result = await this.handleInvokeRequest(request.params);
      } else {
        throw createJSONRPCError(-32601);
      }

      return buildJSONRPCResult(request.id, result);
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

  async handleGetMethodsRequest(params) {
    const {version} = params;

    if (version === undefined) {
      throw createClientError(`'getMethods' method version is missing`);
    }

    if (version !== GET_METHODS_METHOD_VERSION) {
      throw createClientError(`'getMethods' method version ${version} is unsupported`);
    }

    return this.publicMethods;
  }

  async handleInvokeRequest(params) {
    const {name, input, environment, version} = params;

    if (version === undefined) {
      throw createClientError(`'invoke' method version is missing`);
    }

    if (version !== INVOKE_METHOD_VERSION) {
      throw createClientError(`'invoke' method version ${version} is unsupported`);
    }

    if (!name) {
      throw createClientError(`Method name is missing`);
    }

    if (!this.publicMethods.includes(name)) {
      throw createClientError(`Remote method '${name}' doesn't exist`);
    }

    let output = await this.resource[name](input, environment);

    if (output && output.$serialize) {
      output = output.$serialize();
    }

    return {output};
  }
}

export default RemoteResourceJSONRPCHandler;
