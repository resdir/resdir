import {join} from 'path';
import {outputFileSync} from 'fs-extra';

const RESOURCE_IMPLEMENTATION = `module.exports = base =>
  class extends base {
    // Resource implementation
  };
`;

export default base =>
  class JSResource extends base {
    async _createJSResource() {
      const directory = this.$getCurrentDirectory();
      const file = join(directory, 'src', 'resource.js');
      outputFileSync(file, RESOURCE_IMPLEMENTATION);
      this.$implementation = './src/resource.js';
      await this.$save();
    }
  };
