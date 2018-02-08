export function createClientError(messageOrError = 'Unknown client error', data) {
  return _createError(messageOrError, {...data, $isClientError: true});
}

export function createServerError(messageOrError = 'Unknown server error', data) {
  return _createError(messageOrError, {...data, $isServerError: true});
}

export function createRemoteError(messageOrError = 'Unknown remote error', data) {
  return _createError(messageOrError, {...data, $isRemoteError: true});
}

export function isClientError(error) {
  return Boolean(error && error.$isClientError);
}

export function isServerError(error) {
  return Boolean(error && error.$isServerError);
}

export function isRemoteError(error) {
  return Boolean(error && error.$isRemoteError);
}

function _createError(messageOrError, data) {
  const error = messageOrError instanceof Error ? messageOrError : new Error(messageOrError);
  Object.assign(error, data);
  return error;
}
