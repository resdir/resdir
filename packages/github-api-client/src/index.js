// THIS PACKAGE HAS BEEN UNPUBLISHED

// import {fetch} from '@resdir/http-client';
// import LocalCache from '@resdir/local-cache';
//
// const ROOT_URL = 'https://api.github.com';
// const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
// const TIMEOUT = 15 * 1000; // 15 secs
//
// export class GitHubAPIClient {
//   constructor({username, password, token}) {
//     if (username && password) {
//       this.authorization = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
//     } else if (token) {
//       this.authorization = 'Token ' + token;
//     }
//   }
//
//   async get(url, options = {}) {
//     options = {cache: getCache(), expectedStatus: 200, ...options};
//     return await this.fetch(url, options);
//   }
//
//   async post(url, body, options = {}) {
//     options = {method: 'POST', body, expectedStatus: [200, 201, 204], ...options};
//     return await this.fetch(url, options);
//   }
//
//   async put(url, body, options = {}) {
//     options = {method: 'PUT', body, expectedStatus: [200, 204], ...options};
//     return await this.fetch(url, options);
//   }
//
//   async delete(url, options = {}) {
//     options = {method: 'DELETE', expectedStatus: [200, 204], ...options};
//     return await this.fetch(url, options);
//   }
//
//   async fetch(url, {throwIfNotFound = true, ...options} = {}) {
//     url = ROOT_URL + url;
//
//     options = {
//       json: true,
//       authorization: this.authorization,
//       timeout: TIMEOUT,
//       ...options
//     };
//
//     try {
//       return await fetch(url, options);
//     } catch (err) {
//       if (err.httpStatus === 404 && throwIfNotFound === false) {
//         return undefined;
//       }
//       throw err;
//     }
//   }
// }
//
// let cache;
// function getCache() {
//   if (!cache) {
//     cache = new LocalCache({time: CACHE_TIME});
//   }
//   return cache;
// }
//
// export default GitHubAPIClient;
