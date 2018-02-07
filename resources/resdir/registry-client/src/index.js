import {join, dirname} from 'path';
import {upperFirst} from 'lodash';
import {ensureDirSync} from 'fs-extra';
import {
  formatString,
  formatURL,
  formatDim,
  formatValue,
  print,
  emptyLine,
  printText,
  prompt,
  confirm,
  task
} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {SERVICE_NAME, SUPPORT_EMAIL_ADDRESS} from '@resdir/information';
import debugModule from 'debug';

const debug = debugModule('resdir:registry-client');

export default Resource => {
  const _private = {};

  return {
    async ping(_input, environment) {
      const server = await this.getRegistryServer();
      const startTime = Date.now();
      const result = await server.ping(undefined, environment);
      const elapsedTime = Date.now() - startTime;
      const message = `${formatDim('=>')} ${formatValue(result)} ${formatDim(`(${elapsedTime}ms)`)}`;
      print(message, environment);
    },

    // === Registration and authentication ===

    async signUp({email, namespace, permissionToken}, environment) {
      return await this._signUpOrSignIn(
        {action: 'SIGN_UP', email, namespace, permissionToken},
        environment
      );
    },

    async signIn({email}, environment) {
      return await this._signUpOrSignIn({action: 'SIGN_IN', email}, environment);
    },

    async _signUpOrSignIn({action, email, namespace, permissionToken}, environment) {
      const server = await this.getRegistryServer();

      if (this.hasSignedInUser()) {
        throw new Error('A user is already signed in');
      }

      while (!email) {
        emptyLine();
        email = await prompt('Enter your email address:');
        emptyLine();
      }

      await task(
        async () => {
          const method = action === 'SIGN_UP' ? 'startSignUp' : 'startSignIn';
          await server[method]({email}, environment);
        },
        {
          intro: `Sending verification token to ${formatString(email)}...`,
          outro: `Verification token sent to ${formatString(email)}`
        }
      );

      let completed;
      while (!completed) {
        emptyLine();
        const verificationToken = await prompt(
          'Check your mailbox and copy/paste the received token:',
          {type: 'PASSWORD'}
        );
        emptyLine();

        if (!verificationToken) {
          continue;
        }

        const messagePart = action === 'SIGN_UP' ? 'sign up' : 'sign in';
        await task(
          async () => {
            const method = action === 'SIGN_UP' ? 'completeSignUp' : 'completeSignIn';
            const {userId, refreshToken} = await server[method]({verificationToken}, environment);
            this._saveUserId(userId);
            this._saveUserRefreshToken(refreshToken);
            completed = true;
          },
          {intro: `Completing ${messagePart}...`, outro: `${upperFirst(messagePart)} completed`}
        );
      }

      if (action === 'SIGN_UP') {
        await this.createUserNamespace({namespace, permissionToken}, environment);
      }
    },

    async signOut(_input, environment) {
      const server = await this.getRegistryServer();

      this.ensureSignedInUser();

      await task(
        async () => {
          const refreshToken = this._loadUserRefreshToken();
          await server.signOut({refreshToken}, environment);
        },
        {intro: `Signing out...`, outro: `Signed out`}
      );

      this._signOut();
    },

    _signOut() {
      this._saveUserId(undefined);
      this._saveUserRefreshToken(undefined);
      this._saveUserAccessToken(undefined);
    },

    async authenticatedCall(fn, environment) {
      let userAccessToken = await this._loadUserAccessToken(environment);
      const call = async () => {
        return await fn(userAccessToken);
      };
      try {
        return await call();
      } catch (err) {
        if (err.code === 'INVALID_ACCESS_TOKEN') {
          userAccessToken = await this._refreshUserAccessToken(environment);
          return await call();
        }
        throw err;
      }
    },

    // === Namespaces ===

    /* eslint-disable complexity */
    async checkNamespaceAvailability(
      {namespace, type, permissionToken, parentAction, throwIfUnavailable = true},
      environment
    ) {
      if (!(type === 'USER' || type === 'ORGANIZATION')) {
        throw new Error('Invalid \'type\'');
      }

      const server = await this.getRegistryServer();

      const formattedNamespace = formatString(namespace);

      let result = await task(
        async () => {
          return await this.authenticatedCall(
            accessToken =>
              server.checkNamespaceAvailability(
                {namespace, type, permissionToken, accessToken},
                environment
              ),
            environment
          );
        },
        {
          intro: `Checking namespace...`,
          outro: `Namespace checked`
        }
      );

      let {isAvailable, reason} = result;

      if (isAvailable || throwIfUnavailable === false) {
        return result;
      }

      if (reason === 'INVALID') {
        throw new Error(`Sorry, this namespace is invalid. A namespace must be composed of lowercase letters, numbers and dashes ("-").`);
      }

      if (reason === 'TOO_SHORT') {
        throw new Error(`Sorry, a namespace must have a minimum of 2 characters`);
      }

      if (reason === 'ALREADY_TAKEN') {
        let message = `Sorry, this namespace is alrady taken`;
        if (result.existingNamespace !== namespace) {
          message += ` (existing namespace: ${formatString(result.existingNamespace)})`;
        }
        throw new Error(message);
      }

      if (reason === 'RESERVED') {
        throw new Error(`Sorry, this namespace is reserved`);
      }

      let contactSupport;
      if (type === 'USER') {
        contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think your ${SERVICE_NAME} account should have the namespace ${formattedNamespace}, please contact ${SERVICE_NAME} at ${formatURL(SUPPORT_EMAIL_ADDRESS)}.`;
      } else if (type === 'ORGANIZATION') {
        contactSupport = `Namespaces are precious resources, and ${SERVICE_NAME} wants to build a quality directory of organizations and communities. If you think your ${SERVICE_NAME} organization should have the namespace ${formattedNamespace}, please contact ${SERVICE_NAME} at ${formatURL(SUPPORT_EMAIL_ADDRESS)}.`;
      }

      if (reason === 'GENERIC') {
        throw new Error(`Sorry, this namespace is not available because it is a very generic term. ${contactSupport}`);
      }

      if (
        (type === 'USER' && reason === 'IMPORTANT_GITHUB_USER') ||
        (type === 'ORGANIZATION' && reason === 'IMPORTANT_GITHUB_ORGANIZATION')
      ) {
        let message;
        if (type === 'USER') {
          message = `There is a popular GitHub user named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most popular GitHub usernames are reserved for future ${SERVICE_NAME} namespaces.`;
        } else if (type === 'ORGANIZATION') {
          message = `There is a popular GitHub organization named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most popular GitHub identifiers are reserved for future ${SERVICE_NAME} namespaces.`;
        }

        if (result.userHasGitHubAccountConnection) {
          throw new Error(message);
        }

        emptyLine();
        printText(message);
        emptyLine();
        if (type === 'USER') {
          printText(`If the GitHub account named ${formattedNamespace} is yours and you care about this name, you can get it by connecting your ${SERVICE_NAME} account to your GitHub account. Don't worry, ${SERVICE_NAME} will only have access to your GitHub public information.`);
        } else if (type === 'ORGANIZATION') {
          printText(`If you are a public member of the GitHub organization ${formattedNamespace}, you can get this name for your ${SERVICE_NAME} organization by connecting your ${SERVICE_NAME} account to your GitHub account. Don't worry, ${SERVICE_NAME} will only have access to your GitHub public information.`);
        }
        emptyLine();
        const okay = await confirm(`Do you want to continue?`, {default: true});
        emptyLine();

        if (!okay) {
          throw new Error('GitHub connection aborted');
        }

        await this.user.gitHub.connect({parentAction});

        result = await this.checkNamespaceAvailability(
          {
            namespace,
            type,
            parentAction,
            throwIfUnavailable: false
          },
          environment
        );

        ({isAvailable, reason} = result);

        if (isAvailable) {
          return result;
        }

        await this.user.gitHub.disconnect();

        if (type === 'USER' && reason === 'IMPORTANT_GITHUB_USER') {
          throw new Error(`Sorry, the username of the GitHub account you connected to is not ${formattedNamespace}.`);
        }

        if (type === 'ORGANIZATION' && reason === 'IMPORTANT_GITHUB_ORGANIZATION') {
          throw new Error(`Sorry, the GitHub account you connected to is not a public member of ${formattedNamespace} organization.`);
        }

        throw new Error(`Sorry, this namespace is not available.`);
      }

      if (reason === 'IMPORTANT_GITHUB_USER') {
        throw new Error(`Sorry, this namespace is not available because there is a popular GitHub user named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most important GitHub usernames are reserved for future ${SERVICE_NAME} users. ${contactSupport}`);
      }

      if (reason === 'IMPORTANT_GITHUB_ORGANIZATION') {
        throw new Error(`Sorry, this namespace is not available because there is a popular GitHub organization named ${formattedNamespace}. Although ${SERVICE_NAME} is not related to GitHub, most important GitHub organizations are reserved for future ${SERVICE_NAME} organizations or communities. ${contactSupport}`);
      }

      if (reason === 'BIG_COMPANY') {
        throw new Error(`Sorry, this namespace is not available because it matches the name of a big company (${formatString(result.company)}). ${contactSupport}`);
      }

      if (reason === 'COMMON_NUMBER') {
        throw new Error(`Sorry, this namespace is not available because it is quite a common number. ${contactSupport}`);
      }

      if (reason === 'TOP_LEVEL_DOMAIN') {
        throw new Error(`Sorry, this namespace is not available because it is a Top Level Domain. ${contactSupport}`);
      }

      if (reason === 'COMMON_FILE_EXTENSION') {
        throw new Error(`Sorry, this namespace is not available because it is a common file extension. ${contactSupport}`);
      }

      if (reason === 'COMMON_ENGLISH_WORD' || reason === 'COMMON_TAG') {
        throw new Error(`Sorry, this namespace is not available because it is quite a common term. ${contactSupport}`);
      }

      throw new Error(`Sorry, this namespace is not available. ${contactSupport}`);
    },

    /* eslint-enable complexity */

    // === User session ===

    ensureSignedInUser({throwIfNoSignedInUser = true} = {}) {
      const userId = this._loadUserId();
      if (!userId) {
        if (throwIfNoSignedInUser) {
          throw new Error('No user is signed in');
        }
        return undefined;
      }
      return userId;
    },

    hasSignedInUser() {
      return Boolean(this._loadUserId());
    },

    _loadUserId() {
      if (!_private.userId) {
        _private.userId = this._loadData().userId;
      }
      return _private.userId;
    },

    _saveUserId(userId) {
      _private.userId = userId;
      this._updateData({userId});
    },

    // === Authentication internals ===

    _loadUserRefreshToken() {
      if (!_private.userRefreshToken) {
        _private.userRefreshToken = this._loadData().userRefreshToken;
      }
      return _private.userRefreshToken;
    },

    _saveUserRefreshToken(userRefreshToken) {
      _private.userRefreshToken = userRefreshToken;
      this._updateData({userRefreshToken});
    },

    async _loadUserAccessToken(environment) {
      if (!_private.userAccessTokenValue) {
        const data = this._loadData();
        _private.userAccessTokenValue = data.userAccessTokenValue;
        _private.userAccessTokenExpiresOn = data.userAccessTokenExpiresOn;
        if (_private.userAccessTokenExpiresOn) {
          _private.userAccessTokenExpiresOn = new Date(_private.userAccessTokenExpiresOn);
        }
      }
      if (!_private.userAccessTokenValue) {
        await this._refreshUserAccessToken(environment);
      }
      if (!_private.userAccessTokenValue) {
        return undefined;
      }
      if (
        _private.userAccessTokenExpiresOn &&
        Date.now() > _private.userAccessTokenExpiresOn - 3 * 60 * 1000
      ) {
        // Refresh access token 3 minutes before expiration
        await this._refreshUserAccessToken(environment);
      }
      return _private.userAccessTokenValue;
    },

    async _refreshUserAccessToken(environment) {
      const server = await this.getRegistryServer();
      debug('_refreshUserAccessToken()');
      let userAccessTokenValue;
      let userAccessTokenExpiresOn;
      try {
        const refreshToken = this._loadUserRefreshToken();
        if (!refreshToken) {
          return;
        }
        const {accessToken: {value, expiresIn}} = await server.generateAccessToken(
          {refreshToken},
          environment
        );
        userAccessTokenValue = value;
        userAccessTokenExpiresOn = new Date(Date.now() + expiresIn);
        return value;
      } finally {
        this._saveUserAccessToken(userAccessTokenValue, userAccessTokenExpiresOn);
      }
    },

    _saveUserAccessToken(userAccessTokenValue, userAccessTokenExpiresOn) {
      _private.userAccessTokenValue = userAccessTokenValue;
      _private.userAccessTokenExpiresOn = userAccessTokenExpiresOn;
      this._updateData({userAccessTokenValue, userAccessTokenExpiresOn});
    },

    // === Data ===

    _loadData() {
      return load(this._getDataFile(), {throwIfNotFound: false}) || {};
    },

    _saveData(data) {
      ensureDirSync(dirname(this._getDataFile()));
      save(this._getDataFile(), data);
    },

    _updateData(newData) {
      const data = this._loadData();
      Object.assign(data, newData);
      this._saveData(data);
    },

    _getDataFile() {
      return join(this.$getClientDirectory(), 'resdir-registry', 'data.json');
    },

    // === Registry server ===

    async getRegistryServer() {
      if (!this._registryServer) {
        const specifier = this.registryServer;
        if (!specifier) {
          throw new Error(`'registryServer' attribute is missing`);
        }
        this._registryServer = await Resource.$import(specifier);
      }
      return this._registryServer;
    }
  };
};
