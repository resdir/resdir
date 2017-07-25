import {join} from 'path';
import {outputFileSync} from 'fs-extra';
import GitIgnore from '@resdir/gitignore-manager';

const RESOURCE_IMPLEMENTATION = `export default base =>
  class extends base {
    // Resource implementation
  };
`;

const GIT_IGNORE = ['/dist'];

export default base =>
  class JSESNextResource extends base {
    async _createJSESNextResource() {
      const directory = this.$getCurrentDirectory();

      const file = join(directory, 'src', 'resource.js');
      outputFileSync(file, RESOURCE_IMPLEMENTATION);

      GitIgnore.load(directory).add(GIT_IGNORE).save();

      this.$implementation = './dist/resource.js';

      await this.$save();

      await this['@build']();
    }
  };
