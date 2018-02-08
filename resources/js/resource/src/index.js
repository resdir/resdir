import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import GitIgnore from '@resdir/gitignore-manager';

// Warning: js/transpiler onCreated() method depends on the beginning
// of this default implementation
const RESOURCE_IMPLEMENTATION = `module.exports = Resource => ({
  async exampleMethod({arg1, arg2}, environment) {
    return arg1 + ', ' + arg2;
  }
});
`;

const GIT_IGNORE = ['.DS_STORE', '/*.log'];

export default () => ({
  async onCreated({generateGitignore}) {
    const directory = this.$getCurrentDirectory();

    if (generateGitignore) {
      GitIgnore.load(directory)
        .add(GIT_IGNORE)
        .save();
    }

    if (this.$implementation) {
      return;
    }
    this.$implementation = './src';
    await this.$save();

    const implementationFile = join(directory, 'src', 'index.js');
    if (pathExistsSync(implementationFile)) {
      return;
    }
    outputFileSync(implementationFile, RESOURCE_IMPLEMENTATION);

    await this.$setChild('exampleMethod', {
      '@type': 'method',
      '@input': {
        arg1: {'@type': 'string', '@default': 'a'},
        arg2: {'@type': 'string', '@default': 'b'}
      },
      '@output': {'@type': 'string'}
    });
    await this.$save();
  }
});
