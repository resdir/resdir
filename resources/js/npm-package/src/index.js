import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import {updatePackageFile, publishPackage, fetchNPMRegistry} from '@resdir/package-manager';
import {task, prompt, formatString, formatCode} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';

const PACKAGE_CODE = `// Package implementation
`;

const GIT_IGNORE = ['.DS_STORE', '/*.log', '/package.json'];

export default () => ({
  async updatePackageFile(_args, environment) {
    await task(
      async () => {
        this._updatePackageFile();
        const quietEnvironment = await environment.$extend({'@quiet': true});
        await this.$getChild('dependencies').updatePackageFile(undefined, quietEnvironment);
      },
      {intro: `Updating package file...`, outro: `Package file updated`},
      environment
    );
  },

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

    let module = this.module;
    if (module && module.startsWith('./')) {
      module = module.slice(2);
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
      module,
      bin: this.bin,
      preferGlobal: this.preferGlobal
    });
  },

  async publish({major, minor, patch, access}, environment) {
    await this['@build']();
    await this['@test']();

    if (major || minor || patch) {
      await this.$getChild('version').bump({major, minor, patch});
    }

    await task(
      async () => {
        await this._publish({access}, environment);
      },
      {
        intro: `Publishing package...`,
        outro: `Package published`
      },
      environment
    );
  },

  async _publish({access}, environment) {
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
    await publishPackage(directory, {access}, environment);
  },

  async onCreated({name, version, gitignore}) {
    while (!name) {
      name = await prompt('Package name:');
    }

    while (!version) {
      version = await prompt('Version number:', {default: '0.1.0'});
    }

    const directory = this.$getCurrentDirectory();

    this.name = name;
    this.version = version;

    if (gitignore) {
      GitIgnore.load(directory)
        .add(GIT_IGNORE)
        .save();
    }

    if (!this.main) {
      this.main = './src';
      const codeFile = join(directory, 'src', 'index.js');
      if (!pathExistsSync(codeFile)) {
        outputFileSync(codeFile, PACKAGE_CODE);
      }
    }

    if (!this.files) {
      this.files = ['./src'];
    }

    await this.$save();
  }
});
