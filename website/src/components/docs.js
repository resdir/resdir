import React from 'react';

import constants from '../constants';
import Sorry from './sorry';

export const Docs = () => (
  <Sorry
    message={
      <span>
        Resdir's documentation is not ready yet. In&nbsp;the&nbsp;meantime, you can check{' '}
        <a href={constants.RUN_WEBSITE_URL + '/docs'}>Run's&nbsp;documentation</a>.
      </span>
    }
  />
);

export default Docs;
