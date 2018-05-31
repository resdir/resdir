import React from 'react';
import PropTypes from 'prop-types';
import RadiumStarter from 'radium-starter';

import constants from '../../constants';

export class FirstSteps extends React.Component {
  static propTypes = {
    style: PropTypes.object
  };

  render() {
    return (
      <RadiumStarter>
        {(t, s) => {
          const {style} = this.props;

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

              <pre style={preStyle}>curl https://install.run.tools | bash</pre>

              <p>
                <span style={numberStyle}>②</span> See what Resdir can do for you:
              </p>

              <pre style={preStyle}>run @registry</pre>

              <p style={{...s.noMargins}}>
                <span style={numberStyle}>③</span> Enjoy{' '}
                <a href={constants.RUN_WEBSITE_URL + '/docs'} style={s.primaryLink}>
                  resources
                </a>! 😊
              </p>
            </div>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default FirstSteps;
