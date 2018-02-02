import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import GitIgnore from '@resdir/gitignore-manager';

// Warning: js/transpiler initialize() method depends on this default implementation:
const RESOURCE_IMPLEMENTATION = `module.exports = (Resource) => ({
  // Resource implementation
});
`;

const GIT_IGNORE = ['.DS_STORE', '*.log', 'node_modules'];

export default () => ({
  async initialize({gitignore}) {
    const directory = this.$getCurrentDirectory();

    const implementationPropertyIsMissing = !this.$implementation;
    const implementationFile = join(directory, 'src', 'index.js');
    const implementationFileIsMissing = !pathExistsSync(implementationFile);

    if (gitignore) {
      GitIgnore.load(directory)
        .add(GIT_IGNORE)
        .save();
    }

    if (implementationPropertyIsMissing) {
      this.$implementation = './src';
      if (implementationFileIsMissing) {
        outputFileSync(implementationFile, RESOURCE_IMPLEMENTATION);
      }
      await this.$save();
    }
  }
});
