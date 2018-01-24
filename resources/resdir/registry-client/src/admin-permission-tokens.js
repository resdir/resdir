import {formatString, task} from '@resdir/console';
import {matchExpression} from '@resdir/expression';

export default base =>
  class PermissionTokens extends base {
    async create({permission, parameters}, environment) {
      if (parameters) {
        parameters = matchExpression(parameters).remainder; // Get rid of the PARSED_EXPRESSION_TAG
      }

      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      root.ensureSignedInUser();

      await task(
        async progress => {
          const {permissionToken} = await root.authenticatedCall(
            accessToken =>
              server.createPermissionToken({permission, parameters, accessToken}, environment),
            environment
          );
          progress.setOutro(`Permission token created: ${formatString(permissionToken)}`);
        },
        {
          intro: `Creating permission token...`
        }
      );
    }
  };
