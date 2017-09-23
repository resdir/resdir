import {getJSON} from '@resdir/http-client';

const ROOT_URL = 'https://api.github.com';
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const TIMEOUT = 15 * 1000; // 15 secs

export class GitHubAPIClient {
  constructor({username, personalAccessToken}) {
    this.authorization =
      'Basic ' + new Buffer(username + ':' + personalAccessToken).toString('base64');
  }

  async get(url, {throwIfNotFound = true, ...options} = {}) {
    url = ROOT_URL + url;

    options = {
      authorization: this.authorization,
      cacheTime: CACHE_TIME,
      timeout: TIMEOUT,
      ...options
    };

    try {
      return await getJSON(url, options);
    } catch (err) {
      if (err.httpStatus === 404 && throwIfNotFound === false) {
        return undefined;
      }
      throw err;
    }
  }
}

export default GitHubAPIClient;
