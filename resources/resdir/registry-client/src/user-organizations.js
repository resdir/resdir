import {print, emptyLine, task, formatString} from '@resdir/console';

export default base =>
  class UserOrganizations extends base {
    async list(_input, environment) {
      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      const userId = root.ensureSignedInUser();

      const {organizations} = await task(
        async () => {
          return await root.authenticatedCall(
            accessToken => server.listUserOrganizations({userId, accessToken}, environment),
            environment
          );
        },
        {
          intro: `Fetching organizations...`,
          outro: `Organizations fetched`
        }
      );

      if (organizations.length === 0) {
        emptyLine();
        print('You don\'t belong to any organization.');
        return;
      }

      emptyLine();
      print(`You belong to ${organizations.length} organizations:`);
      for (const organization of organizations) {
        let name = organization.name;
        if (name) {
          name += ` (${formatString(organization.namespace)})`;
        } else {
          name = formatString(organization.namespace);
        }
        print(`- ${name}`);
      }
    }
  };
