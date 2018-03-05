import './fix';
import isomorphicFetch from 'isomorphic-fetch';

export async function get(url, options) {
  return await fetch(url, options);
}

export async function post(url, body, options) {
  options = {method: 'POST', body, expectedStatus: [200, 201, 204], ...options};
  return await fetch(url, options);
}

export async function put(url, body, options) {
  options = {method: 'PUT', body, expectedStatus: [200, 204], ...options};
  return await fetch(url, options);
}

export async function del(url, options) {
  options = {method: 'DELETE', expectedStatus: [200, 204], ...options};
  return await fetch(url, options);
}

export async function getJSON(url, options) {
  options = {json: true, ...options};
  return await get(url, options);
}

export async function postJSON(url, body, options) {
  options = {json: true, ...options};
  return await post(url, body, options);
}

export async function putJSON(url, body, options) {
  options = {json: true, ...options};
  return await put(url, body, options);
}

export async function deleteJSON(url, options) {
  options = {json: true, ...options};
  return await del(url, options);
}

/* eslint-disable complexity */
export async function fetch(url, options = {}) {
  if (typeof url !== 'string') {
    throw new TypeError(`'url' must be a string`);
  }

  const method = (options.method && options.method.toUpperCase()) || 'GET';

  let result;

  if (options.cache) {
    if (method !== 'GET') {
      throw new Error(`Cache can't be used with a ${method} request`);
    }
    result = await options.cache.read(url, 'utf8');
    if (result) {
      result = JSON.parse(result);
      if (result.body) {
        result.body = Buffer.from(result.body, 'base64');
      }
    }
  }

  if (!result) {
    const finalOptions = {method};

    const headers = options.headers ? {...options.headers} : {};

    if (options.json) {
      headers.Accept = 'application/json';
    }

    let body = options.body;
    if (body !== undefined) {
      if (options.json) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }
      finalOptions.body = body;
    }

    if (options.authorization) {
      headers.Authorization = options.authorization;
    }

    const timeout = options.timeout;
    if (timeout !== undefined) {
      finalOptions.timeout = timeout;
    }

    finalOptions.headers = headers;

    const response = await isomorphicFetch(url, finalOptions);

    result = {status: response.status};

    if (response.status !== 204) {
      if (process.browser) {
        // TODO: Use arrayBuffer() or blob()
        result.body = await response.text();
      } else {
        result.body = await response.buffer();
      }
    }

    if (process.browser) {
      result.headers = {};
      for (const key of response.headers.keys()) {
        result.headers[key.toLowerCase()] = response.headers.get(key);
      }
    } else {
      // TODO: Use a standard way to get headers
      result.headers = response.headers._headers;
      if (!result.headers) {
        throw new Error(`Can't get response headers`);
      }
      for (const key of Object.keys(result.headers)) {
        result.headers[key.toLowerCase()] = result.headers[key].join(',');
      }
    }

    if (options.cache) {
      let serializedResult = {...result};
      if (serializedResult.body) {
        serializedResult.body = serializedResult.body.toString('base64');
      }
      serializedResult = JSON.stringify(serializedResult);
      await options.cache.write(url, serializedResult);
    }
  }

  if (options.json && result.body) {
    const contentType = result.headers['content-type'];
    if (contentType.startsWith('application/json')) {
      result.body = JSON.parse(result.body.toString());
    }
  }

  let expectedStatus = options.expectedStatus;
  if (expectedStatus === undefined) {
    expectedStatus = [200];
  } else if (typeof expectedStatus === 'number') {
    expectedStatus = [expectedStatus];
  } else if (!Array.isArray(expectedStatus)) {
    throw new Error(`'expectedStatus' option is invalid`);
  }

  let throwIfNotFound = options.throwIfNotFound;
  if (throwIfNotFound === undefined) {
    throwIfNotFound = true;
  }
  if (!throwIfNotFound) {
    expectedStatus.push(404);
  }

  if (!expectedStatus.includes(result.status)) {
    const message =
      (result.body && result.body.message) ||
      `Unexpected ${result.status} HTTP status (method: '${method}', url: '${url}')`;
    const error = new Error(message);
    error.status = result.status;
    if (result.body && result.body.code) {
      error.code = result.body.code;
    }
    throw error;
  }

  return result;
}
/* eslint-enable complexity */
