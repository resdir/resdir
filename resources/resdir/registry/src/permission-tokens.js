import {matchExpression} from '@resdir/expression';

export default base =>
  class PermissionTokens extends base {
    async create({permission, parameters}) {
      if (parameters) {
        parameters = matchExpression(parameters).remainder; // Get rid of the PARSED_EXPRESSION_TAG
      }
      await this._getRegistry().createPermissionToken(permission, parameters);
    }

    _getRegistry() {
      return this.$getParent()._getRegistry();
    }
  };
