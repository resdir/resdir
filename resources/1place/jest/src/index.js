import {resolve} from 'path';
import {task} from '@resdir/console';
import {execute} from '@resdir/process-manager';

export default base =>
  class JestResource extends base {
    async run({testPathPattern}, environment) {
      const verboseEnvironment = await environment.$extend({'@verbose': true});
      await task(
        async () => {
          await this._run({testPathPattern}, environment);
        },
        {intro: `Testing resource...`, outro: `Resource tested`},
        verboseEnvironment
      );
    }

    async _run({testPathPattern}, environment) {
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
      await execute(command, args, {directory, commandName: 'jest'}, environment);
    }
  };
