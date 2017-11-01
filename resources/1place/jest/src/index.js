import {resolve} from 'path';
import jest from 'jest';
import {task} from '@resdir/console';
import {execute} from '@resdir/process-manager';

export default base =>
  class JestResource extends base {
    async run({testPathPattern}, {verbose, quiet, debug}) {
      await task(
        async () => {
          await this._run({testPathPattern, verbose, quiet, debug});
        },
        {intro: `Testing resource...`, outro: `Resource tested`, verbose: true, quiet, debug}
      );
    }

    async _run({testPathPattern}) {
      const directory = this.$getCurrentDirectory();

      let roots;
      if (this.roots) {
        roots = this.roots.map(root => resolve(directory, root));
      } else {
        roots = [directory];
      }

      const config = {
        roots,
        setupFiles: [require.resolve('regenerator-runtime/runtime')],
        testEnvironment: this.testEnvironment,
        transform: {}
      };

      const command = require.resolve('jest/bin/jest.js');
      const args = ['--config=' + JSON.stringify(config)];
      if (testPathPattern) {
        args.push('--testPathPattern=' + testPathPattern);
      }
      await execute(command, args, {directory, commandName: 'jest', debug: true});
    }
  };
