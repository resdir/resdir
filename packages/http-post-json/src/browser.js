/* global XMLHttpRequest */

export function postJSON(url, data, {timeout} = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', url, true);

    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201 || xhr.status === 204) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Unexpected ${xhr.status} HTTP status`));
      }
    };

    xhr.onerror = () => {
      reject(new Error(`HTTP request failed`));
    };

    xhr.ontimeout = () => {
      reject(new Error(`HTTP request timed out`));
    };

    if (timeout) {
      xhr.timeout = timeout;
    }

    xhr.send(JSON.stringify(data));
  });
}

export default postJSON;
