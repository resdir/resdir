import {emptyLine, prompt, task, formatString, formatExample} from '@resdir/console';
import {createClientError} from '@resdir/error';

export default () => ({
  async create({namespace, permissionToken}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    const user = await root.user.get();

    if (user.namespace) {
      throw createClientError(`You already have a namespace (${formatString(user.namespace)})`);
    }

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Choose a name for your personal namespace: ${formatExample('aturing')}`);
      emptyLine();
    }

    await root.checkNamespaceAvailability(
      {
        namespace,
        type: 'USER',
        permissionToken,
        parentAction: 'CREATE_USER_NAMESPACE'
      },
      environment
    );

    await task(
      async () => {
        await root.authenticatedCall(
          accessToken =>
            server.createUserNamespace(
              {userId: user.id, namespace, permissionToken, accessToken},
              environment
            ),
          environment
        );
      },
      {
        intro: `Creating namespace ${formatString(namespace)}...`,
        outro: `Namespace ${formatString(namespace)} created`
      }
    );
  },

  async delete(_input, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    const user = await root.user.get();

    if (!user.namespace) {
      throw createClientError(`You don't have a namespace`);
    }

    await task(
      async () => {
        await root.authenticatedCall(
          accessToken => server.deleteUserNamespace({userId: user.id, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Removing namespace ${formatString(user.namespace)}...`,
        outro: `Namespace ${formatString(user.namespace)} removed`
      }
    );
  }
});
