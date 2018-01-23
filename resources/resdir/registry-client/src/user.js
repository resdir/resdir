import {formatString, emptyLine, confirm, task} from '@resdir/console';

export default base =>
  class User extends base {
    async show(_input, environment) {
      console.dir(await this._get(environment), {depth: null, colors: true});
    }

    async delete(_input, environment) {
      const root = this.$getRoot();
      const server = await root._getRegistryServer();

      const user = await this._get(environment);

      emptyLine();
      const okay = await confirm(`Are you sure you want to delete your account (${formatString(user.email)})?`);
      emptyLine();

      if (!okay) {
        return;
      }

      emptyLine();
      const reallyOkay = await confirm(`Really?`);
      emptyLine();

      if (!reallyOkay) {
        return;
      }

      await task(
        async () => {
          await root._authenticatedCall(
            accessToken => server.deleteUser({userId: user.id, accessToken}, environment),
            environment
          );
        },
        {
          intro: `Deleting ${formatString(user.email)} account...`,
          outro: `${formatString(user.email)} account deleted`
        }
      );

      root._signOut();
    }

    async _get(environment) {
      const root = this.$getRoot();
      const server = await root._getRegistryServer();

      if (!this._user) {
        const userId = root._ensureSignedInUser();

        const {user} = await task(
          async () => {
            return await root._authenticatedCall(
              accessToken => server.getUser({userId, accessToken}, environment),
              environment
            );
          },
          {intro: `Fetching user...`, outro: `User fetched`}
        );

        this._user = user;
      }

      return this._user;
    }

    async _getByNamespace(namespace, environment) {
      const root = this.$getRoot();
      const server = await root._getRegistryServer();

      if (!namespace) {
        throw new Error('\'namespace\' argument is missing');
      }

      const {user} = await task(
        async () => {
          return await root._authenticatedCall(
            accessToken => server.getUserByNamespace({namespace, accessToken}, environment),
            environment
          );
        },
        {
          intro: `Fetching ${formatString(namespace)} user...`,
          outro: `${formatString(namespace)} user fetched`
        }
      );

      return user;
    }
  };
