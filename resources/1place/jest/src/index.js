import {resolve} from 'path';
import jest from 'jest';
import {task} from '@resdir/console';

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

      const argv = {
        config: JSON.stringify(config),
        testPathPattern
      };

      await new Promise((resolve, reject) => {
        jest
          .runCLI(argv, [directory], results => {
            resolve(results);
          })
          .catch(reject);
      });
    }
  };
