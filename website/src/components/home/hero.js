import React from 'react';
import PropTypes from 'prop-types';
import RadiumStarter from 'radium-starter';

import constants from '../../constants';
import FirstSteps from './first-steps';

export class Hero extends React.Component {
  static propTypes = {
    style: PropTypes.object
  };

  render() {
    return (
      <RadiumStarter>
        {(t, s) => {
          const {style} = this.props;

          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px',
                ...style
              }}
            >
              <h1 style={{textAlign: 'center'}}>Just born! 🐣</h1>
              <h3
                style={{
                  ...s.subheading,
                  maxWidth: '720px',
                  textAlign: 'center',
                  marginBottom: '2rem',
                  [`@media (max-width: ${t.smallBreakpoint})`]: {
                    marginBottom: '1.5rem'
                  }
                }}
              >
                For now, Resdir is only accessible through{' '}
                <a href={constants.RUN_WEBSITE_URL} style={{...s.primaryLink}}>
                  Run
                </a>'s&nbsp;command line interface.
              </h3>
              <FirstSteps />
            </div>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default Hero;
