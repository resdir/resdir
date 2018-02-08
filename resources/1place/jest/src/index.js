import {resolve} from 'path';
import {task} from '@resdir/console';
import {execute} from '@resdir/process-manager';
import {createClientError} from '@resdir/error';

export default () => ({
  async run({testPathPattern}, environment) {
    const verboseEnvironment = await environment.$extend({'@verbose': true});
    await task(
      async () => {
        environment = await environment.$extend({'@debug': true});

        const directory = this.$getCurrentDirectory();

        let roots;
        if (this.roots) {
          roots = this.roots.map(root => resolve(directory, root));
        } else {
          roots = [directory];
        }

        const config = {
          roots,
          // setupFiles: [require.resolve('regenerator-runtime/runtime')],
          testEnvironment: this.testEnvironment,
          transform: {}
        };

        const command = require.resolve('jest/bin/jest.js');
        const args = ['--config=' + JSON.stringify(config)];
        if (testPathPattern) {
          args.push('--testPathPattern=' + testPathPattern);
        }
        try {
          await execute(command, args, {directory, commandName: 'jest'}, environment);
        } catch (err) {
          throw createClientError('Resource test failed');
        }
      },
      {intro: `Testing resource...`, outro: `Resource tested`},
      verboseEnvironment
    );
  }
});
