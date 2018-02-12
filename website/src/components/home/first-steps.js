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

    return (
      <div
        style={{
          width: '800px',
          padding: '18px 25px',
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: t.borderColor,
          borderRadius: '15px',
          fontSize: t.h5FontSize,
          ...style
        }}
      >
        <p>
          <span
            style={{
              marginRight: '7px',
              fontSize: '1.8rem',
              verticalAlign: '-0.2rem',
              color: t.extraColor1
            }}
          >
            ①
          </span>{' '}
          Install Run:
        </p>

        <pre style={{fontSize: t.h6FontSize}}>
          <span style={{color: t.borderColor}}>></span> npm install run-cli -g
        </pre>

        <p>
          <span
            style={{
              marginRight: '7px',
              fontSize: '1.8rem',
              verticalAlign: '-0.2rem',
              color: t.extraColor1
            }}
          >
            ②
          </span>{' '}
          Look what Resdir can do for you:
        </p>

        <pre style={{fontSize: t.h6FontSize}}>
          <span style={{color: t.borderColor}}>></span> run @registry
        </pre>

        <p style={{...s.noMargins}}>
          <span
            style={{
              marginRight: '7px',
              fontSize: '1.8rem',
              verticalAlign: '-0.2rem',
              color: t.extraColor1
            }}
          >
            ③
          </span>{' '}
          Enjoy! 😊
        </p>
      </div>
    );
  }
}

export default FirstSteps;
