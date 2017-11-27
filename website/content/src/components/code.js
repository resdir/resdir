import React from 'react';
import PropTypes from 'prop-types';
import Lowlight from 'react-lowlight';

import js from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import shell from 'highlight.js/lib/languages/shell';
import bash from 'highlight.js/lib/languages/bash';

Lowlight.registerLanguage('javascript', js);
Lowlight.registerLanguage('js', js);
Lowlight.registerLanguage('json', json);
Lowlight.registerLanguage('json-key', json);
Lowlight.registerLanguage('xml', xml);
Lowlight.registerLanguage('html', xml);
Lowlight.registerLanguage('shell', shell);
Lowlight.registerLanguage('bash', bash);
Lowlight.registerLanguage('js', js);

export class Code extends React.Component {
  static propTypes = {
    language: PropTypes.string,
    children: PropTypes.string.isRequired
  };

  render() {
    const {language, children: value} = this.props;
    return <Lowlight language={language} value={value} inline />;
  }
}

export function highlightJSStyles(_t) {
  // Source: https://github.com/isagalaev/highlight.js/blob/master/src/styles/atom-one-dark.css
  return {
    '.hljs-comment, .hljs-quote': {
      color: '#5c6370',
      fontStyle: 'italic'
    },
    '.hljs-doctag, .hljs-keyword, .hljs-formula': {
      color: '#c678dd'
    },
    '.hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst': {
      color: '#e06c75'
    },
    '.hljs-literal': {
      color: '#56b6c2'
    },
    '.hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta-string': {
      color: '#98c379'
    },
    '.hljs-built_in, .hljs-class .hljs-title': {
      color: '#e6c07b'
    },
    '.hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number': {
      color: '#d19a66'
    },
    '.hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title': {
      color: '#61aeee'
    },
    '.hljs-emphasis': {
      fontStyle: 'italic'
    },
    '.hljs-strong': {
      fontWeight: 'bold'
    },
    '.hljs-link': {
      textDecoration: 'underline'
    }
  };
}

export default Code;
