/* global Raven */

import React from 'react';
import ReactDOM from 'react-dom';

import constants from './constants';
import App from './components/app';

const SENTRY_DSN = 'https://20e325589bb14b9ba2c5fc3c3878d610@sentry.io/298217';

if (constants.STAGE === 'production') {
  Raven.config(SENTRY_DSN, {release: constants.VERSION, environment: constants.STAGE}).install();
}

ReactDOM.render(<App />, document.getElementById('app'));
