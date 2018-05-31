import React from 'react';
import RadiumStarter from 'radium-starter';

import Logo from './logo';
import Link from './link';

export class Header extends React.Component {
  render() {
    return (
      <RadiumStarter>
        {(t, s) => {
          const menuStyle = {...s.unstyledList, ...s.noMargins};
          const menuItemStyle = {
            ...s.inlineBlock,
            marginLeft: '1.3rem',
            [`@media (max-width: ${t.smallBreakpoint})`]: {
              marginLeft: '1rem'
            }
          };

          return (
            <header
              style={{
                ...s.centeredPage,
                width: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '1rem 1.5rem 0 1.5rem',
                [`@media (max-width: ${t.smallBreakpoint})`]: {
                  padding: '.75rem 1rem .75rem 1rem'
                }
              }}
            >
              <Link to="/">
                <Logo width={115} />
              </Link>
              <div
                style={{
                  marginLeft: '0.6rem',
                  [`@media (max-width: ${t.smallBreakpoint})`]: {
                    display: 'none'
                  }
                }}
              >
                <small style={{color: t.mutedTextColor, letterSpacing: '0.04rem'}}>alpha</small>
              </div>
              <div style={{flexGrow: 1}} />
              <ul style={menuStyle}>
                <li style={menuItemStyle}>
                  <Link key="header-about" to="/about" style={s.primaryLink}>
                    About
                  </Link>
                </li>
                <li style={menuItemStyle}>
                  <a
                    key="header-support"
                    href="https://github.com/resdir/resdir/issues"
                    style={s.primaryLink}
                  >
                    Support
                  </a>
                </li>
              </ul>
            </header>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default Header;
