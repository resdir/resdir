/* global window */

// Fix Googlebot's fetch()

if (typeof window !== 'undefined') {
  const agent = window.navigator && window.navigator.userAgent;
  if (agent) {
    if (agent.indexOf('Googlebot') !== -1 || agent.indexOf('Chrome/41.') !== -1) {
      window.fetch = undefined;
    }
  }
}
