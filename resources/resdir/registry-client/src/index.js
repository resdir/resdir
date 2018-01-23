import {join, resolve, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {upperFirst} from 'lodash';
import {ensureDirSync, moveSync} from 'fs-extra';
import hasha from 'hasha';
import isDirectory from 'is-directory';
import readDirectory from 'recursive-readdir';
import opn from 'opn';
import {
  formatString,
  formatPath,
  formatCode,
  formatURL,
  formatExample,
  print,
  emptyLine,
  printSuccess,
  printText as originalPrintText,
  prompt,
  confirm,
  task
} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import generateSecret from '@resdir/secret-generator';
import {getJSON, postJSON, deleteJSON, get, put} from '@resdir/http-client';
import {gzipSync, gunzipSync} from 'zlib';
import {zip, unzip} from '@resdir/archive-manager';
import {SERVICE_NAME, SUPPORT_EMAIL_ADDRESS, REGISTRY_URL} from '@resdir/information';
import debugModule from 'debug';

const debug = debugModule('resdir:registry-client');

export default base =>
  class ResdirRegistryClient extends base {
    async hello(_input, environment) {
      const server = await this._getRegistryServer();
      console.time('remoteCall');
      console.log(await server.hello(undefined, environment));
      console.timeEnd('remoteCall');
    }

    async signUp({email, namespace, permissionToken}, environment) {
      return await this._signUpOrSignIn(
        {action: 'SIGN_UP', email, namespace, permissionToken},
        environment
      );
    }

    async signIn({email}, environment) {
      return await this._signUpOrSignIn({action: 'SIGN_IN', email}, environment);
    }

    async _signUpOrSignIn({action, email, namespace, permissionToken}, environment) {
      const server = await this._getRegistryServer();

      if (this._hasSignedInUser()) {
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
    }

    async signOut(_input, environment) {
      const server = await this._getRegistryServer();

      this._ensureSignedInUser();

      await task(
        async () => {
          const refreshToken = this._loadUserRefreshToken();
          await server.signOut({refreshToken}, environment);
        },
        {intro: `Signing out...`, outro: `Signed out`}
      );

      this._signOut();
    }

    _signOut() {
      this._saveUserId(undefined);
      this._saveUserRefreshToken(undefined);
      this._saveUserAccessToken(undefined);
    }

    // === User session ===

    _ensureSignedInUser({throwIfNoSignedInUser = true} = {}) {
      const userId = this._loadUserId();
      if (!userId) {
        if (throwIfNoSignedInUser) {
          throw new Error('No user is signed in');
        }
        return undefined;
      }
      return userId;
    }

    _hasSignedInUser() {
      return Boolean(this._loadUserId());
    }

    _loadUserId() {
      if (!this._userId) {
        this._userId = this._loadData().userId;
      }
      return this._userId;
    }

    _saveUserId(userId) {
      this._userId = userId;
      this._updateData({userId});
    }

    // === Authentication ===

    async _authenticatedCall(fn, environment) {
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
    }

    _loadUserRefreshToken() {
      if (!this._userRefreshToken) {
        this._userRefreshToken = this._loadData().userRefreshToken;
      }
      return this._userRefreshToken;
    }

    _saveUserRefreshToken(userRefreshToken) {
      this._userRefreshToken = userRefreshToken;
      this._updateData({userRefreshToken});
    }

    async _loadUserAccessToken(environment) {
      if (!this._userAccessTokenValue) {
        const data = this._loadData();
        this._userAccessTokenValue = data.userAccessTokenValue;
        this._userAccessTokenExpiresOn = data.userAccessTokenExpiresOn;
        if (this._userAccessTokenExpiresOn) {
          this._userAccessTokenExpiresOn = new Date(this._userAccessTokenExpiresOn);
        }
      }
      if (!this._userAccessTokenValue) {
        await this._refreshUserAccessToken(environment);
      }
      if (!this._userAccessTokenValue) {
        return undefined;
      }
      if (
        this._userAccessTokenExpiresOn &&
        Date.now() > this._userAccessTokenExpiresOn - 3 * 60 * 1000
      ) {
        // Refresh access token 3 minutes before expiration
        await this._refreshUserAccessToken(environment);
      }
      return this._userAccessTokenValue;
    }

    async _refreshUserAccessToken(environment) {
      const server = await this._getRegistryServer();
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
    }

    _saveUserAccessToken(userAccessTokenValue, userAccessTokenExpiresOn) {
      this._userAccessTokenValue = userAccessTokenValue;
      this._userAccessTokenExpiresOn = userAccessTokenExpiresOn;
      this._updateData({userAccessTokenValue, userAccessTokenExpiresOn});
    }

    // === Data ===

    _loadData() {
      return load(this._getDataFile(), {throwIfNotFound: false}) || {};
    }

    _saveData(data) {
      ensureDirSync(dirname(this._getDataFile()));
      save(this._getDataFile(), data);
    }

    _updateData(newData) {
      const data = this._loadData();
      Object.assign(data, newData);
      this._saveData(data);
    }

    _getDataFile() {
      return join(this.$getClientDirectory(), 'resdir-registry', 'data.json');
    }

    // === Registry server ===

    async _getRegistryServer() {
      if (!this._registryServer) {
        const specifier = process.env.RESDIR_REGISTRY_SERVER_SPECIFIER;
        this._registryServer = await this.constructor.$import(specifier);
      }
      return this._registryServer;
    }
  };
