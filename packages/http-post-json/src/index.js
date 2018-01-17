/* global XMLHttpRequest */

import nodePostJSON from './node';
import browserPostJSON from './browser';

export function postJSON(url, data, {timeout} = {}) {
  const implementation = typeof XMLHttpRequest === 'undefined' ? nodePostJSON : browserPostJSON;
  return implementation(url, data, {timeout});
}

export default postJSON;
