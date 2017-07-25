import {join} from 'path';
import {readFileSync, statSync} from 'fs';
import {tmpdir} from 'os';
import {outputFile} from 'fs-extra';
import pick from 'lodash.pick';
import nodeFetch from 'node-fetch';
import strictUriEncode from 'strict-uri-encode';

export async function getJSON(url, options = {}) {
  options.json = 'true';
  if (!options.expectedStatus) {
    options.expectedStatus = 200;
  }
  return await fetch(url, options);
}

export async function fetch(url, options = {}) {
  if (typeof url !== 'string') {
    throw new TypeError('\'url\' must be a string');
  }

  let cacheFile;

  if (options.cacheTime) {
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

  const opts = {};

  if (options.json) {
    opts.headers = {Accept: 'application/json'};
  }

  Object.assign(opts, pick(options, ['method', 'headers', 'timeout']));

  const response = await nodeFetch(url, opts);

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
  if (options.json) {
    result = await response.json();
  } else {
    result = await response.arrayBuffer();
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
