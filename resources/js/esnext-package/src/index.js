import GitIgnore from '@resdir/gitignore-manager';

const GIT_IGNORE = ['/dist'];

export default base =>
  class JSESNextPackage extends base {
    async _createJSESNextPackage(_name) {
      const directory = this.$getCurrentDirectory();
      GitIgnore.load(directory).add(GIT_IGNORE).save();

      this.files = ['./dist'];
      await this.$setChild('main', './dist/index.js');

      await this.$save();

      await this['@build']();
    }
  };
