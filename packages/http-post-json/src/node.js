export function postJSON(url, data, {timeout} = {}) {
  return new Promise((resolve, reject) => {
    const {parse} = require('url');

    const parsedURL = parse(url);

    const requestBody = JSON.stringify(data);

    let module;
    if (parsedURL.protocol === 'http:') {
      module = 'http';
    } else if (parsedURL.protocol === 'https:') {
      module = 'https';
    } else {
      throw new Error(`Unsupported URL protocol (${parsedURL.protocol})`);
    }
    module = require(module);

    const options = {
      ...parsedURL,
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Content-Length': requestBody.length},
      timeout
    };

    const request = module.request(options, response => {
      let responseBody = '';

      response.setEncoding('utf8');

      response.on('data', chunk => {
        responseBody += chunk;
      });

      response.on('end', () => {
        const status = response.statusCode;
        if (status === 200 || status === 201 || status === 204) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`Unexpected ${status} HTTP status`));
        }
      });
    });

    request.on('error', err => {
      reject(err);
    });

    request.on('timeout', () => {
      reject(new Error(`HTTP request timed out`));
    });

    request.write(requestBody);

    request.end();
  });
}

export default postJSON;
