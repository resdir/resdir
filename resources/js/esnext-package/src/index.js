import GitIgnore from '@resdir/gitignore-manager';

const GIT_IGNORE = ['/dist'];

export default base =>
  class JSESNextPackage extends base {
    async '@initialize'({gitignore, ...args}) {
      const directory = this.$getCurrentDirectory();

      const mainPropertyIsMissing = !this.main.$serialize();
      const filesPropertyIsMissing = !this.files;

      await super['@initialize']({gitignore, ...args});

      if (gitignore) {
        GitIgnore.load(directory)
          .add(GIT_IGNORE)
          .save();
      }

      if (mainPropertyIsMissing) {
        await this.$setChild('main', './dist/index.js');
      }

      if (filesPropertyIsMissing) {
        this.files = ['./dist'];
      }

      await this.$save();

      await this['@build']();
    }
  };
