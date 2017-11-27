import React from 'react';
import {RadiumStarter} from 'radium-starter';

import Layout from './layout';
import ErrorBoundary from './error-boundary';

@ErrorBoundary
@RadiumStarter
export class Contact extends React.Component {
  render() {
    const s = this.styles;

    return (
      <Layout style={{justifyContent: 'center', alignItems: 'center'}}>
        <h3 style={{...s.subheading}}>You can reach us here:</h3>
        <h1>
          <a href="mailto:hello@resdir.com" target="_blank" rel="noopener noreferrer">
            hello@resdir.com
          </a>
        </h1>
      </Layout>
    );
  }
}

export default Contact;
