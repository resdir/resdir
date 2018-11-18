import {formatString, formatExample, emptyLine, prompt, confirm, task} from '@resdir/console';

export default () => ({
  async create({namespace, permissionToken}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    root.ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(
        `Choose a namespace for your organization: ${formatExample('twitter')}`
      );
      emptyLine();
    }

    await root.checkNamespaceAvailability(
      {
        namespace,
        type: 'ORGANIZATION',
        permissionToken,
        parentAction: 'CREATE_ORGANIZATION'
      },
      environment
    );

    await task(
      async () => {
        await root.authenticatedCall(
          accessToken =>
            server.createOrganization({namespace, permissionToken, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Creating organization...`,
        outro: `Organization created`
      }
    );
  },

  async delete({namespace}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    root.ensureSignedInUser();

    while (!namespace) {
      emptyLine();
      namespace = await prompt(`Organization namespace:`);
      emptyLine();
    }

    const organization = await this.getByNamespace(namespace);

    emptyLine();
    const okay = await confirm(
      `Are you sure you want to delete ${formatString(namespace)} organization?`
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
          accessToken =>
            server.deleteOrganization({organizationId: organization.id, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Deleting ${formatString(namespace)} organization...`,
        outro: `${formatString(namespace)} organization deleted`
      }
    );
  },

  async getByNamespace(namespace, environment) {
    if (!namespace) {
      throw new Error("'namespace' argument is missing");
    }

    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    const {organization} = await task(
      async () => {
        return await root.authenticatedCall(
          accessToken => server.getOrganizationByNamespace({namespace, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Fetching ${formatString(namespace)} organization...`,
        outro: `${formatString(namespace)} organization fetched`
      }
    );

    return organization;
  },

  async addMember({organizationNamespace, userNamespace}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    while (!organizationNamespace) {
      emptyLine();
      organizationNamespace = await prompt(`Organization namespace:`);
      emptyLine();
    }

    const organization = await this.getByNamespace(organizationNamespace);

    while (!userNamespace) {
      emptyLine();
      userNamespace = await prompt(`User namespace:`);
      emptyLine();
    }

    const user = await root.users.getByNamespace(userNamespace);

    await task(
      async () => {
        await root.authenticatedCall(
          accessToken =>
            server.addOrganizationMember(
              {organizationId: organization.id, memberId: user.id, accessToken},
              environment
            ),
          environment
        );
      },
      {
        intro: `Adding member...`,
        outro: `Member added`
      }
    );
  },

  async removeMember({organizationNamespace, userNamespace}, environment) {
    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    while (!organizationNamespace) {
      emptyLine();
      organizationNamespace = await prompt(`Organization namespace:`);
      emptyLine();
    }

    const organization = await this.getByNamespace(organizationNamespace);

    while (!userNamespace) {
      emptyLine();
      userNamespace = await prompt(`User namespace:`);
      emptyLine();
    }

    const user = await root.users.getByNamespace(userNamespace);

    await task(
      async () => {
        await root.authenticatedCall(
          accessToken =>
            server.removeOrganizationMember(
              {organizationId: organization.id, memberId: user.id, accessToken},
              environment
            ),
          environment
        );
      },
      {
        intro: `Removing member...`,
        outro: `Member removed`
      }
    );
  }
});
