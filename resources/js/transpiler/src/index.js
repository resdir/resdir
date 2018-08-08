import {join, resolve, relative, extname, isAbsolute} from 'path';
import {readFileSync, writeFileSync, existsSync, statSync, utimesSync, chmodSync} from 'fs';
import {isEqual} from 'lodash';
import {copy, readFile, outputFile, emptyDirSync} from 'fs-extra';
import isDirectory from 'is-directory';
import {transform} from '@babel/core';
import {task, formatString, formatCode, formatPath} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';
import {createClientError} from '@resdir/error';

const babelPresetEnv = require.resolve('@babel/preset-env');
const babelPresetReact = require.resolve('@babel/preset-react');
const babelPluginClassProperties = require.resolve('@babel/plugin-proposal-class-properties');
const babelPluginClasses = require.resolve('@babel/plugin-transform-classes');
const babelPluginDecorators = require.resolve('@babel/plugin-proposal-decorators');
const babelPluginLodash = require.resolve('babel-plugin-lodash');

export default () => ({
  async run({files}, environment) {
    const transpilationOccurred = await task(
      async progress => {
        const transpilationOccurred = await this._run(files, environment);
        if (!transpilationOccurred) {
          progress.setOutro(`Transpiler has not changed anything`);
        }
        return transpilationOccurred;
      },
      {
        intro: `Transpiling files...`,
        outro: `Files transpiled`
      },
      environment
    );

    if (transpilationOccurred) {
      await this.$emit('transpilationOccurred');
    }
  },

  async _run(files, environment = {}) {
    const directory = this.$getParent().$getCurrentDirectory();
    const source = resolve(directory, this.source);
    const destination = resolve(directory, this.getResolvedDestination());

    if (isDirectory.sync(source)) {
      return await this._transpileOrCopy(source, destination, files, environment);
    }

    await this._transpile(source, destination, environment);

    return true;
  },

  async _transpileOrCopy(srcDirectory, destDirectory, files, environment) {
    let transpilationOccurred = false;

    if (!files) {
      files = [srcDirectory];
    }

    const transpilableFiles = [];

    for (const srcFile of files) {
      const relativeFile = relative(srcDirectory, srcFile);
      if (relativeFile.startsWith('..')) {
        if (!environment['@quiet']) {
          console.warn(`Cannot build a file (${formatPath(srcFile)}) located outside of the source directory (${formatPath(srcDirectory)})`);
        }
        continue;
      }

      const destFile = join(destDirectory, relativeFile);

      await copy(srcFile, destFile, {
        preserveTimestamps: true,

        filter: file => {
          const relativeFile = relative(srcDirectory, file);

          if (isDirectory.sync(file)) {
            const targetDir = join(destDirectory, relativeFile);
            if (isDirectory.sync(targetDir)) {
              if (environment['@verbose']) {
                console.log(`Cleaning ${formatPath(targetDir)}...`);
              }
              emptyDirSync(targetDir);
            }
            transpilationOccurred = true;
            return true;
          }

          const extension = extname(file);
          if (!this.extensions.includes(extension)) {
            if (environment['@verbose']) {
              console.log(`Copying ${formatPath(file)}...`);
            }
            transpilationOccurred = true;
            return true;
          }

          transpilableFiles.push(relativeFile);
          return false;
        }
      });
    }

    for (const file of transpilableFiles) {
      const srcFile = join(srcDirectory, file);
      const destFile = join(destDirectory, file);
      await this._transpile(srcFile, destFile, environment);
      transpilationOccurred = true;
    }

    return transpilationOccurred;
  },

  async _transpile(srcFile, destFile, environment = {}) {
    if (environment['@verbose']) {
      console.log(`Transpiling ${formatPath(srcFile)}...`);
    }

    const code = await readFile(srcFile, 'utf8');
    const {atime, mtime, mode} = statSync(srcFile);

    if (!(this.format === 'cjs' || this.format === 'esm')) {
      throw createClientError(`Invalid ${formatCode('format')} value (${formatString(this.format)})`);
    }

    const plugins = [
      [babelPluginDecorators, {legacy: true}],
      [babelPluginClassProperties, {loose: true}],
      babelPluginLodash
    ];

    if (this.transformClasses) {
      plugins.push([
        babelPluginClasses,
        {
          loose: true
        }
      ]);
    }

    const modules = this.format === 'cjs' ? 'commonjs' : false;
    const presets = [[babelPresetEnv, {targets: this.targets, loose: true, modules}]];
    if (this.transformJSX) {
      presets.unshift([babelPresetReact, {pragma: this.jsxPragma}]);
    }

    const transformOptions = {plugins, presets};

    if (this.generateInlineSourceMaps) {
      transformOptions.sourceMaps = 'inline';
    }

    const {code: transpiledCode} = transform(code, {
      ...transformOptions,
      sourceFileName: srcFile
    });

    await outputFile(destFile, transpiledCode);
    utimesSync(destFile, atime, mtime);
    chmodSync(destFile, mode);
  },

  getResolvedDestination() {
    return this.destination.replace('${format}', this.format); // eslint-disable-line no-template-curly-in-string
  },

  async onCreated({generateGitignore}, environment) {
    if (this.$isRoot()) {
      // This creation method works only with child properties
      return;
    }

    if (this.$getIsUnpublishable() === undefined) {
      this.$setIsUnpublishable(true);
    }

    const root = this.$getRoot();
    const directory = root.$getCurrentDirectory();
    const resolvedDestination = this.getResolvedDestination();

    if (root.$implementation === './src') {
      root.$implementation = resolvedDestination;
      const implementationFile = join(directory, 'src', 'index.js');
      if (existsSync(implementationFile)) {
        let code = readFileSync(implementationFile, 'utf8');
        if (code.startsWith('module.exports = Resource =>')) {
          code = 'export default Resource =>' + code.slice('module.exports = Resource =>'.length);
          writeFileSync(implementationFile, code);
        }
      }
    }

    if (root.isJSNPMPackageResource) {
      if (this.format === 'cjs') {
        if (root.main === './src') {
          root.main = resolvedDestination;
        }
        if (isEqual(root.files, ['./src'])) {
          root.files = [resolvedDestination];
        }
      } else if (this.format === 'esm') {
        if (!root.module) {
          root.module = resolvedDestination;
        }
        if (isEqual(root.files, ['./dist/cjs'])) {
          root.files = ['./dist/cjs', resolvedDestination];
        }
      }
    }

    if (generateGitignore) {
      let destination = resolvedDestination;
      if (!isAbsolute(destination) && !destination.startsWith('..')) {
        if (!destination.startsWith('./')) {
          destination = './' + destination;
        }
        if (destination.startsWith('./')) {
          destination = destination.slice(1);
        }
        GitIgnore.load(directory)
          .add([destination])
          .save();
      }
    }

    await this.run(undefined, environment);

    await root.$save();
  }
});
