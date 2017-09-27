import isomorphicFetch from 'isomorphic-fetch';

export async function getJSON(url, options = {}) {
  options.json = 'true';
  if (!options.expectedStatus) {
    options.expectedStatus = 200;
  }
  return await fetch(url, options);
}

export async function postJSON(url, body, options = {}) {
  options.method = 'POST';
  options.body = body;
  options.json = 'true';
  if (!options.expectedStatus) {
    options.expectedStatus = [200, 201, 204];
  }
  return await fetch(url, options);
}

/* eslint-disable complexity */
export async function fetch(url, options = {}) {
  if (typeof url !== 'string') {
    throw new TypeError('\'url\' must be a string');
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
        result.body = new Buffer(result.body, 'base64');
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
        result.headers[key] = response.headers.get(key);
      }
    } else {
      // TODO: Use a standard way to get headers
      result.headers = response.headers._headers;
      if (!result.headers) {
        throw new Error('Can\'t get response headers');
      }
      for (const key of Object.keys(result.headers)) {
        result.headers[key] = result.headers[key].join(',');
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

  let expectedStatus = options.expectedStatus;
  if (expectedStatus) {
    if (!Array.isArray(expectedStatus)) {
      expectedStatus = [expectedStatus];
    }
    if (!expectedStatus.includes(result.status)) {
      const error = new Error(`Unexpected ${result.status} HTTP status`);
      error.httpStatus = result.status;
      throw error;
    }
  }

  if (options.json && result.body) {
    result.body = JSON.parse(result.body.toString());
  }

  return result;
}
/* eslint-enable complexity */
