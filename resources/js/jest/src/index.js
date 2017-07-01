import {resolve} from 'path';
import jest from 'jest';

export default base =>
  class JestResource extends base {
    async run() {
      const directory = this.$getDirectory();

      let roots;
      if (this.roots) {
        roots = this.roots.map(root => resolve(directory, root));
      } else {
        roots = [directory];
      }

      const config = {
        roots,
        testEnvironment: this.testEnvironment
      };

      const argv = {
        config: JSON.stringify(config)
      };

      await jest.runCLI(argv, [directory]);
    }
  };
