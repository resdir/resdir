import React from 'react';
import PropTypes from 'prop-types';
import Radium from 'radium';
const {Style} = Radium;
import {RadiumStarterRoot, withRadiumStarter} from 'radium-starter';
import Color from 'color';

import {highlightJSStyles} from './code';

import Root from './root';
import {getModal} from '../modal';

function theme() {
  // Color source: https://color.adobe.com/oddend-color-theme-2181/
  return {
    primaryColor: '#FF358B', // Resdir logo's magenta
    lightPrimaryColor: t =>
      Color(t.primaryColor)
        .lighten(0.2)
        .string(),
    accentColor: '#01B0F0', // Cyan
    backgroundColor: '#171717',
    borderColor: '#444444',
    baseTextColor: '#CCCCCC',
    baseInverseTextColor: t => t.backgroundColor,
    secondaryTextColor: '#8A8A8A', // Resdir logo's gray
    mutedTextColor: t => t.secondaryTextColor,
    headingsColor: '#ECF0F1', // Almost white,
    headingsFontWeight: '500',
    headingsLineHeight: t => t.baseLineHeight,
    linkColor: t => t.accentColor,
    hoveredLinkColor: t =>
      Color(t.linkColor)
        .lighten(0.4)
        .string(),
    codeColor: t => t.baseTextColor,
    codeBackgroundColor: t => t.altBackgroundColor,
    preColor: t => t.codeColor,
    preBackgroundColor: t => t.codeBackgroundColor,
    modularScaleRatio: 1.25,
    // Custom variables
    altBackgroundColor: '#1B2836',
    extraColor1: '#AEEE00' // Flashy green
  };
}

function styles(t, _s) {
  return {
    centeredPage: {maxWidth: '1280px', margin: '0 auto'},
    subheading: {fontWeight: '300', color: t.secondaryTextColor},
    primaryLink: {
      color: t.primaryColor,
      ':hover': {color: t.lightPrimaryColor, textDecoration: 'none'}
    }
  };
}

function globalStyles(t) {
  return {
    hr: {
      marginTop: '1.5rem',
      marginBottom: '1.5rem'
    },
    code: {
      padding: '.2rem .2rem',
      borderRadius: 0,
      fontSize: '.85rem'
    },
    pre: {
      display: 'table',
      tableLayout: 'fixed',
      width: '100%',
      marginTop: '1.3rem',
      marginBottom: '1.3rem',
      padding: '.3rem .6rem',
      fontSize: '.85rem'
    },
    'pre code': {
      display: 'table-cell !important',
      overflowX: 'auto'
    },
    '.json-key .hljs-string': {
      color: '#d19a66' // hljs-attr
    },
    mediaQueries: {
      [`(max-width: ${t.smallBreakpoint})`]: {
        h1: {fontSize: t.h3FontSize, lineHeight: t.smallLineHeight},
        h2: {fontSize: t.h4FontSize},
        h3: {fontSize: t.h5FontSize},
        h4: {fontSize: t.h6FontSize},
        h5: {fontSize: t.h6FontSize},
        code: {fontSize: '.75rem'},
        pre: {fontSize: '.75rem'}
      }
    }
  };
}

export class App extends React.Component {
  render() {
    return (
      <RadiumStarterRoot theme={theme} styles={styles}>
        <Main />
        {getModal().createElement()}
      </RadiumStarterRoot>
    );
  }
}

@withRadiumStarter
class Main extends React.Component {
  static propTypes = {
    theme: PropTypes.object.isRequired
  };

  render() {
    return (
      <div>
        <Style
          rules={{...highlightJSStyles(this.props.theme), ...globalStyles(this.props.theme)}}
        />
        <Root />
      </div>
    );
  }
}

export default App;
