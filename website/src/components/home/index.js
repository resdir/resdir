import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import Layout from '../layout';
import FirstSteps from './first-steps';

@withRadiumStarter
export class Home extends React.Component {
  static propTypes = {
    theme: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {theme: t, styles: s} = this.props;

    return (
      <Layout
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '5rem 1.5rem 10rem 1.5rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <h1 style={{textAlign: 'center'}}>Just born! 🐣</h1>
          <h3 style={{...s.subheading, maxWidth: '800px', textAlign: 'center'}}>
            Resdir is still in an early stage of development, and for now it is only available
            through{' '}
            <a href="https://run.tools" style={{color: t.accentColor}}>
              Run
            </a>'s command line interface.
          </h3>
          <FirstSteps style={{marginTop: '3rem'}} />
        </div>
      </Layout>
    );
  }
}

export default Home;
