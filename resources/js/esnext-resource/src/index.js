import {join} from 'path';
import {outputFileSync} from 'fs-extra';

const RESOURCE_IMPLEMENTATION = `export default base =>
  class extends base {
    // Resource implementation
  };
`;

export default base =>
  class JSESNextResource extends base {
    async _createJSESNextResource() {
      const directory = this.$getCurrentDirectory();
      const file = join(directory, 'src', 'resource.js');
      outputFileSync(file, RESOURCE_IMPLEMENTATION);
      this.$implementation = './dist/resource.js';
      await this.$save();
      await this['@build']();
    }
  };
