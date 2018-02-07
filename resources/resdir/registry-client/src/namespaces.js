import {formatString, task, print} from '@resdir/console';

export default () => ({
  async checkAvailability({namespace}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    const {available, reason} = await task(
      async () => {
        return await root.authenticatedCall(
          accessToken => server.checkNamespaceAvailability({namespace, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Checking namespace...`,
        outro: `Namespace checked...`
      }
    );

    if (available) {
      print(`The namespace ${formatString(namespace)} is available.`);
    } else {
      print(`The namespace ${formatString(namespace)} is not available (reason: ${formatString(reason)}).`);
    }
  }
});
