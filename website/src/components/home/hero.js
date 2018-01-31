import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import Link from '../link';
import Terminal from './terminal';

const COMMAND_EXAMPLES = [
  'run deps add lodash',
  'run deps install',
  'run publish --patch',
  'run frontend deploy',
  'run @build',
  'run @test',
  'run deploy',
  'run @create js/resource',
  'run @create js/npm-package',
  'run @create aws/website',
  'run @add js/transpiler',
  'run @add aws/hosted-resource',
  'run @add aws/dynamodb-table',
  'run @add web/builder',
  'run @add web/server',
  'run @add method completeTask',
  'run @registry organization create',
  'run @registry community create'
];

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
          padding: '1.5rem 10px 0 10px',
          ...style
        }}
      >
        <h1 style={{textAlign: 'center'}}>Make software development fun&nbsp;again! 🎉</h1>
        <h3 style={{...s.subheading, maxWidth: '800px', textAlign: 'center'}}>
          Forget Grandpa{'\''}s shell paradigms, use{' '}
          <Link
            to="/#intro"
            style={{
              ...s.italic,
              color: t.accentColor,
              ':hover': {color: t.lightPrimaryColor, textDecoration: 'none'}
            }}
          >
            @resources
          </Link>{' '}
          to create and consume a brand-new generation of tools.
        </h3>
        <Terminal commands={COMMAND_EXAMPLES} style={{marginTop: '1.5rem'}} />
      </div>
    );
  }
}

export default Hero;
