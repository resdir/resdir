import React from 'react';
import PropTypes from 'prop-types';
import {RadiumStarter} from 'radium-starter';
import {postJSON} from '@resdir/http-client';
import URLSearchParams from 'url-search-params';

import Logo from './logo';
import FullHeight from './full-height';
import {ErrorBoundary, errorBoundary} from './error-boundary';

@ErrorBoundary
@RadiumStarter
export class ConnectGitHubAccount extends React.Component {
  static propTypes = {
    match: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired
  };

  state = {
    message: undefined,
    info: undefined
  };

  componentDidMount() {
    const token = this.props.match.params.token;
    const gitHubCode = new URLSearchParams(this.props.location.search).get('code');
    if (gitHubCode) {
      this.completeConnectGitHubAccount(token, gitHubCode);
    } else {
      this.startConnectGitHubAccount(token);
    }
  }

  @errorBoundary
  async startConnectGitHubAccount(token) {
    this.setState({message: 'Redirecting to GitHub...'});

    const url = `${process.env.RESDIR_REGISTRY_URL}/user/continue-connect-github-account`;
    const {body: {gitHubStartSignInURL}} = await postJSON(url, {token});
    if (!gitHubStartSignInURL) {
      throw new Error('\'gitHubStartSignInURL\' is missing');
    }

    window.location = gitHubStartSignInURL;
  }

  @errorBoundary
  async completeConnectGitHubAccount(token, gitHubCode) {
    this.setState({message: 'Completing GitHub connection...'});

    const url = `${process.env.RESDIR_REGISTRY_URL}/user/complete-connect-github-account`;
    const {body: {parentAction}} = await postJSON(url, {token, gitHubCode});

    let info;
    if (parentAction === 'CREATE_USER_NAMESPACE') {
      info = 'Now go back to the shell to continue creating your namespace.';
    } else if (parentAction === 'CREATE_ORGANIZATION') {
      info = 'Now go back to the shell to continue creating your organization.';
    }
    this.setState({message: 'GitHub connection completed', info});
  }

  render() {
    const s = this.styles;

    const {message, info} = this.state;

    if (!message) {
      return null;
    }

    return (
      <FullHeight>
        <div
          style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Logo width={150} />
          <h3 style={[{marginTop: '1.5rem'}]}>{message}</h3>
          {info && <h4 style={s.subheading}>{info}</h4>}
        </div>
      </FullHeight>
    );
  }
}

export default ConnectGitHubAccount;