import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import FirstSteps from './first-steps';

@withRadiumStarter
export class Hero extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    theme: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {style, theme: t, styles: s} = this.props;

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
            maxWidth: '890px',
            textAlign: 'center',
            marginBottom: '2rem',
            [`@media (max-width: ${t.smallBreakpoint})`]: {
              marginBottom: '1.5rem'
            }
          }}
        >
          Resdir – the resource directory – is still in development, and&nbsp;for&nbsp;now,
          it&nbsp;is only available through{' '}
          <a href={process.env.RUN_WEBSITE_URL} style={{...s.primaryLink}}>
            Run
          </a>'s command line interface.
        </h3>
        <FirstSteps />
      </div>
    );
  }
}

export default Hero;
