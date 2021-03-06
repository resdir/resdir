import {join} from 'path';
import {outputFileSync, pathExistsSync} from 'fs-extra';
import {updatePackageFile, publishPackage, fetchNPMRegistry} from '@resdir/package-manager';
import {task, prompt, formatString, formatCode, formatPath} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';
import {createClientError} from '@resdir/error';

const PACKAGE_CODE = `// Package implementation
`;

const GIT_IGNORE = ['.DS_STORE', '/*.log', '/package.json'];

export default () => ({
  async updatePackageFile(_args, environment) {
    const formattedDirectory = formatPath(this.$getCurrentDirectory(), {
      baseDirectory: './',
      relativize: true
    });

    await task(
      async () => {
        this._updatePackageFile();
      },
      {
        intro: `Updating package attributes in package file (${formattedDirectory})...`,
        outro: `Package attributes in package file updated (${formattedDirectory})`
      },
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

    let browser = this.browser;
    if (browser && browser.startsWith('./')) {
      browser = browser.slice(2);
    }

    updatePackageFile(directory, {
      name: this.name,
      version: this.version,
      private: this.private,
      description: this.description,
      keywords: this.keywords,
      homepage: this.homepage,
      author: this.author,
      contributors: this.contributors,
      license: this.license,
      repository: this.repository,
      files,
      main,
      module,
      browser,
      bin: this.bin
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
      throw createClientError(`${formatCode('name')} property is missing`);
    }
    if (!this.version) {
      throw createClientError(`${formatCode('version')} property is missing`);
    }
    if (!this.description) {
      throw createClientError(`${formatCode('description')} property is missing`);
    }

    const pkg = await fetchNPMRegistry(this.name, {throwIfNotFound: false});
    if (pkg && this.version in pkg.versions) {
      throw createClientError(
        `Can't publish over the previously published version ${formatString(
          this.version
        )}. Before publishing, use ${formatCode('version bump')} to increment the version number.`
      );
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
