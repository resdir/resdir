import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';
import URLSearchParams from 'url-search-params';

import {getRegistryServer} from '../registry-server';
import Logo from './logo';
import FullHeight from './full-height';
import {withErrorBoundary, catchErrors} from './error-boundary';

@withErrorBoundary
@withRadiumStarter
export class ConnectGitHubAccount extends React.Component {
  static propTypes = {
    match: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
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

  @catchErrors
  async startConnectGitHubAccount(token) {
    this.setState({message: 'Redirecting to GitHub...'});

    const registryServer = await getRegistryServer();
    const {gitHubStartSignInURL} = await registryServer.continueConnectGitHubAccount({token});
    if (!gitHubStartSignInURL) {
      throw new Error('\'gitHubStartSignInURL\' is missing');
    }

    window.location = gitHubStartSignInURL;
  }

  @catchErrors
  async completeConnectGitHubAccount(token, gitHubCode) {
    this.setState({message: 'Completing GitHub connection...'});

    const registryServer = await getRegistryServer();
    const {parentAction} = await registryServer.completeConnectGitHubAccount({token, gitHubCode});

    let info;
    if (parentAction === 'CREATE_USER_NAMESPACE') {
      info = 'Now go back to the shell to continue creating your namespace.';
    } else if (parentAction === 'CREATE_ORGANIZATION') {
      info = 'Now go back to the shell to continue creating your organization.';
    }
    this.setState({message: 'GitHub connection completed', info});
  }

  render() {
    const {styles: s} = this.props;

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
