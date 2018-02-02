import {task, print, formatCode, formatValue} from '@resdir/console';
import {matchExpression} from '@resdir/expression';

export default () => ({
  async invokeMethod({name, arguments: args}, environment) {
    if (args) {
      args = matchExpression(args).remainder; // Get rid of the PARSED_EXPRESSION_TAG
    }

    const root = this.$getRoot();
    const server = await root.getRegistryServer();

    let output;

    await task(
      async () => {
        output = await root.authenticatedCall(
          accessToken => server[name]({...args, accessToken}, environment),
          environment
        );
      },
      {
        intro: `Invoking ${formatCode(name)} method...`,
        outro: `${formatCode(name)} invoked`
      }
    );

    if (output !== undefined) {
      if (output.$inspect) {
        output.$inspect();
      } else {
        print(formatValue(output));
      }
    }
  }
});
