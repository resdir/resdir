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

    const number = {
      marginRight: '6px',
      fontSize: '1.8rem',
      verticalAlign: '-0.17rem',
      color: t.accentColor
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
          ...style
        }}
      >
        <p>
          <span style={number}>①</span> Install Run:
        </p>

        <pre style={{fontSize: t.h6FontSize}}>
          <span style={{color: t.mutedTextColor}}>></span> npm install run-cli -g
        </pre>

        <p>
          <span style={number}>②</span> Look what Resdir can do for you:
        </p>

        <pre style={{fontSize: t.h6FontSize}}>
          <span style={{color: t.mutedTextColor}}>></span> run @registry
        </pre>

        <p style={{...s.noMargins}}>
          <span style={number}>③</span> Enjoy{' '}
          <a href={process.env.RUN_WEBSITE_URL} style={s.primaryLink}>
            resources
          </a>! 😊
        </p>
      </div>
    );
  }
}

export default FirstSteps;
