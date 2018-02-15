import React from 'react';

import Sorry from './sorry';

export const Docs = () => (
  <Sorry
    message={
      <span>
        Resdir's documentation is not ready yet. In&nbsp;the&nbsp;meantime, you can check{' '}
        <a href={process.env.RUN_WEBSITE_URL + '/docs'}>Run's&nbsp;documentation</a>.
      </span>
    }
  />
);

export default Docs;
