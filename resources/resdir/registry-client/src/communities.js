import {formatString, formatExample, emptyLine, prompt, confirm, task} from '@resdir/console';

export default base =>
  class Communities extends base {
    async create({namespace, permissionToken}, environment) {
      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      root.ensureSignedInUser();

      while (!namespace) {
        emptyLine();
        namespace = await prompt(`Community namespace: ${formatExample('js')}`);
        emptyLine();
      }

      await root.checkNamespaceAvailability(
        {
          namespace,
          type: 'COMMUNITY',
          permissionToken,
          parentAction: 'CREATE_COMMUNITY'
        },
        environment
      );

      await task(
        async () => {
          await root.authenticatedCall(
            accessToken =>
              server.createCommunity({namespace, permissionToken, accessToken}, environment),
            environment
          );
        },
        {
          intro: `Creating community...`,
          outro: `Community created`
        }
      );
    }

    async delete({namespace}, environment) {
      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      root.ensureSignedInUser();

      while (!namespace) {
        emptyLine();
        namespace = await prompt(`Community namespace:`);
        emptyLine();
      }

      const community = await this.getByNamespace(namespace);

      emptyLine();
      const okay = await confirm(`Are you sure you want to delete ${formatString(namespace)} community?`);
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
            accessToken =>
              server.deleteCommunity({communityId: community.id, accessToken}, environment),
            environment
          );
        },
        {
          intro: `Deleting ${formatString(namespace)} community...`,
          outro: `${formatString(namespace)} community deleted`
        }
      );
    }

    async getByNamespace(namespace, environment) {
      if (!namespace) {
        throw new Error('\'namespace\' argument is missing');
      }

      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      const {community} = await task(
        async () => {
          return await root.authenticatedCall(
            accessToken => server.getCommunityByNamespace({namespace, accessToken}, environment),
            environment
          );
        },
        {
          intro: `Fetching ${formatString(namespace)} community...`,
          outro: `${formatString(namespace)} community fetched`
        }
      );

      return community;
    }
  };
