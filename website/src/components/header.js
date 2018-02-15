import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import Logo from './logo';
import Link from './link';

@withRadiumStarter
export class Header extends React.Component {
  static propTypes = {
    theme: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {theme: t, styles: s} = this.props;

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
  }
}

export default Header;
