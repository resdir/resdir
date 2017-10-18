export default base =>
  class Organizations extends base {
    async create({namespace}) {
      await this._getRegistry().createOrganization(namespace);
    }

    async delete({namespace}) {
      await this._getRegistry().deleteOrganization(namespace);
    }

    async addMember({organizationNamespace, userNamespace}) {
      await this._getRegistry().addOrganizationMember(organizationNamespace, userNamespace);
    }

    async removeMember({organizationNamespace, userNamespace}) {
      await this._getRegistry().removeOrganizationMember(organizationNamespace, userNamespace);
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
