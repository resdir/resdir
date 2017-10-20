import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import GitIgnore from '@resdir/gitignore-manager';

const RESOURCE_IMPLEMENTATION = `export default base =>
  class extends base {
    // Resource implementation
  };
`;

const GIT_IGNORE = ['/dist'];

export default base =>
  class JSESNextResource extends base {
    async '@initialize'({gitignore, ...args}) {
      const directory = this.$getCurrentDirectory();

      const implementationPropertyIsMissing = !this.$implementation;
      const implementationFile = join(directory, 'src', 'resource.js');
      const implementationFileIsMissing = !pathExistsSync(implementationFile);

      await super['@initialize']({gitignore, ...args});

      if (gitignore) {
        GitIgnore.load(directory)
          .add(GIT_IGNORE)
          .save();
      }

      if (implementationPropertyIsMissing) {
        this.$implementation = './dist/resource.js';
        if (implementationFileIsMissing) {
          outputFileSync(implementationFile, RESOURCE_IMPLEMENTATION);
          await this['@build']();
        }
        await this.$save();
      }
    }
  };
