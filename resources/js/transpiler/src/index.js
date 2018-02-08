import {join, resolve, relative, extname, isAbsolute} from 'path';
import {readFileSync, writeFileSync, existsSync, statSync, utimesSync, chmodSync} from 'fs';
import {isEqual} from 'lodash';
import {copy, readFile, outputFile, emptyDirSync} from 'fs-extra';
import isDirectory from 'is-directory';
import {transform} from '@babel/core';
import {task, formatString, formatCode, formatPath} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';

const babelPresetEnv = require.resolve('@babel/preset-env');
const babelPresetStage3 = require.resolve('@babel/preset-stage-3');
const babelPresetReact = require.resolve('@babel/preset-react');
const babelPluginDecorators = require.resolve('@babel/plugin-proposal-decorators');
const babelPluginLodash = require.resolve('babel-plugin-lodash');

export default () => ({
  async run({files}, environment) {
    const transpilationOccurred = await task(
      async progress => {
        const transpilationOccurred = await this._transpileOrCopy(files, environment);
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

  async _transpileOrCopy(files, environment = {}) {
    const directory = this.$getParent().$getCurrentDirectory();
    const srcDirectory = resolve(directory, this.source);
    const destination = this.getResolvedDestination();
    const destDirectory = resolve(directory, destination);
    const extensions = this.extensions;

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
            if (environment['@verbose']) {
              console.log(`Cleaning ${formatPath(file)}...`);
            }
            const targetDir = join(destDirectory, relativeFile);
            emptyDirSync(targetDir);
            transpilationOccurred = true;
            return true;
          }
          const extension = extname(file);
          if (!extensions.includes(extension)) {
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

    if (transpilableFiles.length > 0) {
      await this._transpile(srcDirectory, destDirectory, transpilableFiles, environment);
      transpilationOccurred = true;
    }

    return transpilationOccurred;
  },

  async _transpile(srcDirectory, destDirectory, files, environment = {}) {
    for (const file of files) {
      const srcFile = join(srcDirectory, file);

      if (environment['@verbose']) {
        console.log(`Transpiling ${formatPath(srcFile)}...`);
      }

      const code = await readFile(srcFile, 'utf8');
      const {atime, mtime, mode} = statSync(srcFile);

      const formats = [];
      if (this.format === 'cjs' || this.format === 'esm') {
        formats.push(this.format);
      } else if (this.format === 'dual') {
        formats.push('cjs');
        formats.push('esm');
      } else {
        throw new Error(`Invalid ${formatCode('format')} value (${formatString(this.format)})`);
      }

      for (const format of formats) {
        const modules = format === 'cjs' ? 'commonjs' : false;
        const presets = [
          [babelPresetEnv, {targets: this.targets, loose: true, modules}],
          [babelPresetStage3, {loose: true}]
        ];
        if (this.transformJSX) {
          presets.push([babelPresetReact, {pragma: this.jsxPragma}]);
        }

        const plugins = [babelPluginDecorators, babelPluginLodash];

        const transformOptions = {
          presets,
          plugins,
          sourceMaps: 'inline'
        };

        const {code: transpiledCode} = transform(code, {
          ...transformOptions,
          sourceFileName: srcFile
        });

        let destFile = join(destDirectory, file);
        if (format === 'cjs' || formats.length > 1) {
          destFile = setFileExtension(destFile, format === 'cjs' ? 'js' : 'mjs');
        }
        await outputFile(destFile, transpiledCode);
        utimesSync(destFile, atime, mtime);
        chmodSync(destFile, mode);
      }
    }
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

function setFileExtension(file, extension) {
  return file.slice(0, -extname(file).length) + '.' + extension;
}
