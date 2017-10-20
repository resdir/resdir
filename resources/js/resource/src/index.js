import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import GitIgnore from '@resdir/gitignore-manager';

const RESOURCE_IMPLEMENTATION = `module.exports = base =>
  class extends base {
    // Resource implementation
  };
`;

const GIT_IGNORE = ['node_modules'];

export default base =>
  class JSResource extends base {
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
        this.$implementation = './src/resource.js';
        if (implementationFileIsMissing) {
          outputFileSync(implementationFile, RESOURCE_IMPLEMENTATION);
        }
        await this.$save();
      }
    }
  };
