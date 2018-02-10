import {print, printText, printSuccess, emptyLine, formatURL, confirm, task} from '@resdir/console';
import {createClientError} from '@resdir/error';
import opn from 'opn';

export default () => ({
  async connect({parentAction}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    const user = await root.currentUser.get();

    const {gitHubAccountConnectionURL} = await task(
      async () => {
        return await root.authenticatedCall(
          accessToken => server.startConnectGitHubAccount({parentAction, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Fetching connection URL...`,
        outro: `Connection URL fetched`
      }
    );

    printSuccess(`GitHub connection page opened in your browser`);
    emptyLine();
    printText(`If the GitHub connection page doesn't open automatically, please copy/paste the following URL in your browser:`);
    emptyLine();
    print(formatURL(gitHubAccountConnectionURL));

    let app;
    if (user.email === 'mvilatest@3base.com') {
      app = 'Google Chrome Canary';
    }
    opn(gitHubAccountConnectionURL, {wait: false, app});

    emptyLine();
    const okay = await confirm(`Have you completed the GitHub connection?`, {default: true});
    emptyLine();

    if (!okay) {
      throw createClientError('GitHub account connection aborted');
    }

    await this.ensureConnection(environment);
  },

  async disconnect(_input, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    root.ensureSignedInUser();

    await task(
      async () => {
        await root.authenticatedCall(
          accessToken => server.disconnectGitHubAccount({accessToken}, environment),
          environment
        );
      },
      {
        intro: `Diconnecting GitHub account...`,
        outro: `GitHub account diconnected`
      }
    );
  },

  async ensureConnection(environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    root.ensureSignedInUser();

    await task(
      async () => {
        const {connected} = await root.authenticatedCall(
          accessToken => server.checkGitHubConnection({accessToken}, environment),
          environment
        );
        if (!connected) {
          throw createClientError('GitHub account connection failed');
        }
      },
      {
        intro: `Checking GitHub account connection...`,
        outro: `GitHub account connection checked`
      }
    );
  }
});
