import {join} from 'path';
import {outputFileSync} from 'fs-extra';
import GitIgnore from '@resdir/gitignore-manager';

const RESOURCE_IMPLEMENTATION = `module.exports = base =>
  class extends base {
    // Resource implementation
  };
`;

const GIT_IGNORE = ['.DS_STORE', 'node_modules', '*.log'];

export default base =>
  class JSResource extends base {
    async _createJSResource() {
      const directory = this.$getCurrentDirectory();

      const implementation = join(directory, 'src', 'resource.js');
      outputFileSync(implementation, RESOURCE_IMPLEMENTATION);

      GitIgnore.load(directory)
        .add(GIT_IGNORE)
        .save();

      this.$implementation = './src/resource.js';

      await this.$save();
    }
  };
