import {join, resolve} from 'path';
import {ensureDir, pathExists, rename, stat} from 'fs-extra';
import {task, formatCode, formatDim} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';
import {createClientError} from '@resdir/error';
import {exec} from 'pkg';
import bytes from 'bytes';

const GIT_IGNORE = ['/node_modules.*'];

export default () => ({
  async run(_input, environment) {
    if (!this.entry) {
      throw createClientError(`${formatCode('entry')} attribute is missing`);
    }

    if (!this.output) {
      throw createClientError(`${formatCode('output')} attribute is missing`);
    }

    if (!this.platform) {
      throw createClientError(`${formatCode('platform')} attribute is missing`);
    }

    const verboseEnvironment = await environment.$extend({'@verbose': true});

    await task(
      async progress => {
        const startingTime = Date.now();
        const directory = this.$getCurrentDirectory();

        try {
          if (this.reinstallDependencies) {
            await this._startReinstallDependencies(environment);
          }

          const entryFile = resolve(directory, this.entry);
          const outputFile = resolve(directory, this.output);

          let nodeRange = this.nodeVersion;
          if (/^\d+$/.test(nodeRange)) {
            nodeRange = 'node' + nodeRange;
          }
          let platform = this.platform;
          if (platform === 'windows') {
            platform = 'win';
          }
          const arch = this.architecture;
          const target = `${nodeRange}-${platform}-${arch}`;

          const args = [entryFile, '--target', target, '--output', outputFile];
          if (this.isPublic) {
            args.push('--public');
          }
          await exec(args);

          const elapsedTime = Date.now() - startingTime;
          const {size} = await stat(outputFile);
          const info = `(${bytes(size)}, ${elapsedTime}ms)`;
          progress.setOutro(`Executable generated ${formatDim(info)}`);
        } finally {
          if (this.reinstallDependencies) {
            await this._completeReinstallDependencies(environment);
          }
        }
      },
      {
        intro: 'Generating executable...',
        outro: 'Executable generated'
      },
      verboseEnvironment
    );
  },

  async _startReinstallDependencies(environment) {
    const directory = this.$getCurrentDirectory();

    const dependencies = this.$getRoot().$getChild('dependencies');
    if (!dependencies) {
      return;
    }

    await ensureDir(join(directory, 'node_modules'));

    await rename(join(directory, 'node_modules'), join(directory, 'node_modules.original'));

    if (await pathExists(join(directory, 'node_modules.clean-install'))) {
      await rename(join(directory, 'node_modules.clean-install'), join(directory, 'node_modules'));
    }

    await dependencies.update({optimizeDiskSpace: false}, environment);
  },

  async _completeReinstallDependencies(_environment) {
    const directory = this.$getCurrentDirectory();

    if (!(await pathExists(join(directory, 'node_modules.original')))) {
      return;
    }

    if (await pathExists(join(directory, 'node_modules'))) {
      await rename(join(directory, 'node_modules'), join(directory, 'node_modules.clean-install'));
    }

    await rename(join(directory, 'node_modules.original'), join(directory, 'node_modules'));
  },

  async onCreated({generateGitignore}) {
    if (this.$isRoot()) {
      // This creation method works only with child properties
      return;
    }
    const root = this.$getRoot();
    const directory = root.$getCurrentDirectory();
    if (generateGitignore) {
      GitIgnore.load(directory)
        .add(GIT_IGNORE)
        .save();
    }
  }
});
