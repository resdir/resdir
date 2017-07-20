import {resolve} from 'path';
import jest from 'jest';
import {task} from 'run-common';

export default base =>
  class JestResource extends base {
    async run(testPathPattern) {
      await task(
        async () => {
          await this._run({testPathPattern});
        },
        {intro: `Testing resource...`, outro: `Resource tested`, verbose: true}
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
