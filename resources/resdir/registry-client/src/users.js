import {formatString, task} from '@resdir/console';

export default () => ({
  async getByNamespace(namespace, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    if (!namespace) {
      throw new Error("'namespace' argument is missing");
    }

    const {user} = await task(
      async () => {
        return await root.authenticatedCall(
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
});
