import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

@withRadiumStarter
export class FirstSteps extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    theme: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {style, theme: t, styles: s} = this.props;

    const numberStyle = {
      marginRight: '6px',
      fontSize: '1.8rem',
      verticalAlign: '-0.17rem',
      color: t.accentColor,
      [`@media (max-width: ${t.smallBreakpoint})`]: {
        marginRight: '4px',
        fontSize: '1.5rem',
        verticalAlign: '-0.1rem'
      }
    };

    const preStyle = {
      fontSize: t.h6FontSize,
      [`@media (max-width: ${t.smallBreakpoint})`]: {
        fontSize: '.75rem'
      }
    };

    return (
      <div
        style={{
          width: '500px',
          padding: '18px 25px',
          backgroundColor: t.backgroundColor,
          borderWidth: 0,
          borderRadius: '15px',
          fontSize: t.h5FontSize,
          [`@media (max-width: ${t.smallBreakpoint})`]: {
            width: '300px',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '1rem'
          },
          ...style
        }}
      >
        <p>
          <span style={numberStyle}>①</span> Install Run:
        </p>

        <pre style={preStyle}>
          <span style={{color: t.mutedTextColor}}>></span> npm install run-cli -g
        </pre>

        <p>
          <span style={numberStyle}>②</span> Look what Resdir can do for you:
        </p>

        <pre style={preStyle}>
          <span style={{color: t.mutedTextColor}}>></span> run @registry
        </pre>

        <p style={{...s.noMargins}}>
          <span style={numberStyle}>③</span> Enjoy{' '}
          <a href={process.env.RUN_WEBSITE_URL} style={s.primaryLink}>
            resources
          </a>! 😊
        </p>
      </div>
    );
  }
}

export default FirstSteps;
