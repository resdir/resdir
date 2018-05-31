import React from 'react';
import PropTypes from 'prop-types';
import RadiumStarter from 'radium-starter';

import Link from './link';

export class Footer extends React.Component {
  static propTypes = {
    style: PropTypes.object
  };

  render() {
    return (
      <RadiumStarter>
        {(t, s) => {
          const {style} = this.props;

          const columnGapStyle = {
            width: '6rem',
            [`@media (max-width: ${t.smallBreakpoint})`]: {width: '3rem'}
          };
          const menuStyle = [s.unstyledList, s.noMargins];
          const menuItemStyle = [{marginBottom: '.5rem'}];
          const menuItemLinkStyle = [{':hover': {textDecoration: 'none'}}];

          return (
            <footer
              style={{
                padding: '3rem 0',
                backgroundColor: t.altBackgroundColor,
                [`@media (max-width: ${t.smallBreakpoint})`]: {padding: '1.5rem 0'}
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  ...style
                }}
              >
                <div>
                  <ul style={[menuStyle]}>
                    <li style={menuItemStyle}>
                      <Link key="footer-about" to="/about" style={menuItemLinkStyle}>
                        About
                      </Link>
                    </li>
                    <li style={menuItemStyle}>
                      <Link key="footer-terms" to="/terms" style={menuItemLinkStyle}>
                        Terms
                      </Link>
                    </li>
                    <li style={menuItemStyle}>
                      <Link key="footer-privacy" to="/privacy" style={menuItemLinkStyle}>
                        Privacy
                      </Link>
                    </li>
                  </ul>
                </div>
                <div style={columnGapStyle}>&nbsp;</div>
                <div>
                  <ul style={[menuStyle]}>
                    <li style={menuItemStyle}>
                      <Link key="footer-docs" to="/docs" style={menuItemLinkStyle}>
                        Docs
                      </Link>
                    </li>
                    <li style={menuItemStyle}>
                      <a
                        key="footer-support"
                        href="https://github.com/resdir/resdir/issues"
                        style={menuItemLinkStyle}
                      >
                        Support
                      </a>
                    </li>
                    <li style={menuItemStyle}>
                      <Link key="footer-contact" to="/contact" style={menuItemLinkStyle}>
                        Contact
                      </Link>
                    </li>
                  </ul>
                </div>
                <div style={[columnGapStyle]}>&nbsp;</div>
                <div>
                  <ul style={[menuStyle]}>
                    <li style={menuItemStyle}>
                      <a
                        key="footer-github"
                        href="https://github.com/resdir/resdir"
                        style={menuItemLinkStyle}
                      >
                        GitHub
                      </a>
                    </li>
                    <li style={menuItemStyle}>
                      <a
                        key="footer-twitter"
                        href="https://twitter.com/res_dir"
                        style={menuItemLinkStyle}
                      >
                        Twitter
                      </a>
                    </li>
                    <li style={menuItemStyle}>
                      <a
                        key="footer-youtube"
                        href="https://www.youtube.com/channel/UCo_whoDTtPWdLzdlgMGOWfQ"
                        style={menuItemLinkStyle}
                      >
                        YouTube
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div
                style={{
                  marginTop: '3rem',
                  textAlign: 'center',
                  [`@media (max-width: ${t.smallBreakpoint})`]: {marginTop: '1.5rem'}
                }}
              >
                <small style={{color: t.mutedTextColor}}>
                  © {new Date().getFullYear()}{' '}
                  <a href="https://1place.io/" style={{color: t.primaryTextColor}}>
                    1Place Inc.
                  </a>
                </small>
              </div>
            </footer>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default Footer;
