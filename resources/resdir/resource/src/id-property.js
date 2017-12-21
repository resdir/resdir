import {
  getResourceNamespace,
  getResourceName,
  parseResourceIdentifier,
  validateResourceIdentifier
} from '@resdir/resource-identifier';

export default base =>
  class IdProperty extends base {
    async getNamespace() {
      return getResourceNamespace(this.$value);
    }

    async getName() {
      return getResourceName(this.$value);
    }

    async parse({throwIfMissing}) {
      return parseResourceIdentifier(this.$value, {throwIfMissing});
    }

    async validate({throwIfInvalid}) {
      return validateResourceIdentifier(this.$value, {throwIfInvalid});
    }
  };
