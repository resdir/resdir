import React from 'react';
import PropTypes from 'prop-types';
import {RadiumStarter} from 'radium-starter';

import Layout from './layout';

@RadiumStarter
export class Sorry extends React.Component {
  static propTypes = {
    message: PropTypes.string.isRequired
  };

  render() {
    const s = this.styles;

    return (
      <Layout style={{justifyContent: 'center', alignItems: 'center', padding: '1.5rem 1.5rem'}}>
        <h1>Sorry! 🙇</h1>
        <h3 style={{...s.subheading, maxWidth: '600px', textAlign: 'center'}}>
          {this.props.message}
        </h3>
      </Layout>
    );
  }
}

export default Sorry;
