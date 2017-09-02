import {join} from 'path';
import {readFileSync, statSync} from 'fs';
import {tmpdir} from 'os';
import {outputFile} from 'fs-extra';
import nodeFetch from 'node-fetch';
import strictUriEncode from 'strict-uri-encode';

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
    options.expectedStatus = [201, 204];
  }
  return await fetch(url, options);
}

/* eslint-disable complexity */
export async function fetch(url, options = {}) {
  if (typeof url !== 'string') {
    throw new TypeError('\'url\' must be a string');
  }

  const method = (options.method && options.method.toUpperCase()) || 'GET';

  let cacheFile;

  if (options.cacheTime) {
    if (!method === 'GET') {
      throw new Error(`Cache can't be used with a ${method} request`);
    }
    const cacheDir = join(tmpdir(), 'resdir-http-client', 'cache');
    cacheFile = join(cacheDir, strictUriEncode(url));

    let stats;
    try {
      stats = statSync(cacheFile);
    } catch (err) {
      /* File is missing */
    }
    if (stats && Date.now() - stats.mtime.getTime() < options.cacheTime) {
      let result = readFileSync(cacheFile);
      if (options.json) {
        result = result.toString();
        result = JSON.parse(result);
      }
      return result;
    }
  }

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

  const response = await nodeFetch(url, finalOptions);

  let expectedStatus = options.expectedStatus;
  if (expectedStatus) {
    if (!Array.isArray(expectedStatus)) {
      expectedStatus = [expectedStatus];
    }
    if (!expectedStatus.includes(response.status)) {
      const error = new Error(`Unexpected ${response.status} HTTP status`);
      error.httpStatus = response.status;
      throw error;
    }
  }

  let result;

  if (response.status !== 204) {
    if (options.json) {
      result = await response.json();
    } else {
      result = await response.buffer();
    }
  }

  if (cacheFile) {
    let data = result;
    if (options.json) {
      data = JSON.stringify(data);
    }
    await outputFile(cacheFile, data);
  }

  return result;
}
/* eslint-enable complexity */
