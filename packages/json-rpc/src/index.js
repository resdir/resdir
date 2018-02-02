export function buildJSONRPCRequest(id, method, params) {
  const request = {jsonrpc: '2.0', id, method, params};
  validateJSONRPCRequest(request);
  return request;
}

export function buildJSONRPCResult(id, result) {
  const response = {jsonrpc: '2.0', id, result};
  validateJSONRPCResponse(response);
  return response;
}

export function buildJSONRPCError(id = null, err) {
  if (err === undefined) {
    err = createJSONRPCError(-32603, `'err' parameter is missing`);
  }

  const error = {
    code: err.jsonRPCErrorCode || 1,
    message: err.message,
    data: {}
  };

  for (const key of Object.keys(err)) {
    if (!(key === 'jsonRPCErrorCode' || key === 'message')) {
      error.data[key] = err[key];
    }
  }

  const response = {jsonrpc: '2.0', error, id};

  return response;
}

export function validateJSONRPCRequest({jsonrpc, method, id, params}) {
  validateJSONRPCAttribute(jsonrpc);

  if (!method) {
    throw createJSONRPCError(-32600, `'method' attribute is missing`);
  }
  if (typeof method !== 'string') {
    throw createJSONRPCError(-32600, `'method' attribute must be a string`);
  }

  validateJSONRPCIdAttribute(id);

  if (
    !(
      typeof params === 'undefined' ||
      Array.isArray(params) ||
      (params !== null && typeof params === 'object')
    )
  ) {
    throw createJSONRPCError(-32602, `'params' attribute must be an array, an object or undefined`);
  }
}

export function validateJSONRPCResponse({jsonrpc, result, error, id}) {
  validateJSONRPCAttribute(jsonrpc);

  if (result !== undefined && error !== undefined) {
    throw createJSONRPCError(
      -32603,
      `A JSON-RPC response cannot have both a 'result' and 'error' attribute`
    );
  }

  if (error !== undefined) {
    if (!error.code || typeof error.code !== 'number') {
      throw createJSONRPCError(-32603, `A JSON-RPC error response must have a 'code' attribute`);
    }

    if (!error.message || typeof error.message !== 'string') {
      throw createJSONRPCError(-32603, `A JSON-RPC error response must have a 'message' attribute`);
    }
  }

  validateJSONRPCIdAttribute(id);
}

function validateJSONRPCAttribute(jsonrpc) {
  if (!jsonrpc) {
    throw createJSONRPCError(-32600, `'jsonrpc' attribute is missing`);
  }

  if (jsonrpc !== '2.0') {
    throw createJSONRPCError(-32600, `'jsonrpc' attribute value must be '2.0'`);
  }
}

function validateJSONRPCIdAttribute(id) {
  if (!(id === null || typeof id === 'number' || typeof id === 'string')) {
    throw createJSONRPCError(-32600, `'id' attribute must be a number, a string or null`);
  }
}

const errors = {
  '-32700': 'Parse error',
  '-32600': 'Invalid request',
  '-32601': 'Method not found',
  '-32602': 'Invalid params',
  '-32603': 'Internal error'
};

export function createJSONRPCError(code, message) {
  if (!message) {
    message = errors[String(code)];
  }

  if (!message) {
    return createJSONRPCError(-32603);
  }

  const err = new Error(message);
  err.jsonRPCErrorCode = code;

  return err;
}
