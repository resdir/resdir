import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import {updatePackageFile, publishPackage, fetchNPMRegistry} from '@resdir/package-manager';
import {task, prompt, formatString, formatCode} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';

const PACKAGE_CODE = `// Package implementation
`;

const GIT_IGNORE = ['.DS_STORE', 'node_modules', '*.log', '/package.json'];

export default base =>
  class Package extends base {
    async updatePackageFile(_args, {verbose, quiet, debug}) {
      await task(
        async () => {
          this._updatePackageFile();
          await this.$getChild('dependencies').updatePackageFile(undefined, {quiet: true});
        },
        {intro: `Updating package file...`, outro: `Package file updated`, verbose, quiet, debug}
      );
    }

    _updatePackageFile() {
      const directory = this.$getCurrentDirectory();

      let files = this.files;
      if (files) {
        files = files.map(file => (file.startsWith('./') ? file.slice(2) : file));
      }

      let main = this.main;
      if (main && main.startsWith('./')) {
        main = main.slice(2);
      }

      updatePackageFile(directory, {
        name: this.name,
        version: this.version,
        description: this.description,
        author: this.author,
        contributors: this.contributors,
        license: this.license,
        repository: this.repository,
        files,
        main,
        bin: this.bin,
        preferGlobal: this.preferGlobal
      });
    }

    async publish({major, minor, patch, access}, {verbose, quiet, debug}) {
      await this['@build']();
      await this['@test']();

      if (major || minor || patch) {
        await this.$getChild('version').bump({major, minor, patch});
      }

      await task(
        async () => {
          await this._publish({access, debug});
        },
        {
          intro: `Publishing package...`,
          outro: `Package published`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async _publish({access, debug}) {
      if (!this.name) {
        throw new Error(`${formatCode('name')} property is missing`);
      }
      if (!this.version) {
        throw new Error(`${formatCode('version')} property is missing`);
      }
      if (!this.description) {
        throw new Error(`${formatCode('description')} property is missing`);
      }

      const pkg = await fetchNPMRegistry(this.name, {throwIfNotFound: false});
      if (pkg && this.version in pkg.versions) {
        throw new Error(`Can't publish over the previously published version ${formatString(this.version)}. Before publishing, use ${formatCode('version bump')} to increment the version number.`);
      }

      const directory = this.$getCurrentDirectory();
      await publishPackage(directory, {access, debug});
    }

    async initialize({name, version, gitignore}) {
      while (!name) {
        name = await prompt('Package name:');
      }

      while (!version) {
        version = await prompt('Version number:', {default: '0.1.0'});
      }

      const directory = this.$getCurrentDirectory();

      const mainPropertyIsMissing = !this.main;
      const codeFile = join(directory, 'src', 'index.js');
      const codeFileIsMissing = !pathExistsSync(codeFile);
      const filesPropertyIsMissing = !this.files;

      this.name = name;
      this.version = version;

      if (gitignore) {
        GitIgnore.load(directory)
          .add(GIT_IGNORE)
          .save();
      }

      if (mainPropertyIsMissing) {
        this.main = './src/index.js';
        if (codeFileIsMissing) {
          outputFileSync(codeFile, PACKAGE_CODE);
        }
      }

      if (filesPropertyIsMissing) {
        this.files = ['./src'];
      }

      await this.$save();
    }
  };
