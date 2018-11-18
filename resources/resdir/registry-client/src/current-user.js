import {formatString, emptyLine, confirm, task} from '@resdir/console';

export default () => ({
  async show(_input, environment) {
    console.dir(await this.get(environment), {depth: null, colors: true});
  },

  async delete(_input, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    const user = await this.get(environment);

    emptyLine();
    const okay = await confirm(
      `Are you sure you want to delete your account (${formatString(user.email)})?`
    );
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
        await root.authenticatedCall(
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
  },

  async get(environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    if (!this._user) {
      const userId = root.ensureSignedInUser();

      const {user} = await task(
        async () => {
          return await root.authenticatedCall(
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
});
