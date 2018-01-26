import {entries} from 'lodash';

export function createClientError(message = 'Unknown client error', data) {
  return _createError(message, data, {expose: true});
}

export function createServerError(message = 'Unknown server error', data) {
  return _createError(message, data, {expose: false});
}

export function isClientError(err) {
  return Boolean(err && err.expose);
}

export function isServerError(err) {
  return Boolean(err && !err.expose);
}

function _createError(message, data, {expose}) {
  const err = new Error(message);
  err.expose = expose;
  if (data) {
    for (const [key, value] of entries(data)) {
      err[key] = value;
    }
  }
  return err;
}
