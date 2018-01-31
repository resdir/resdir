import {join, resolve, relative, extname} from 'path';
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

const GIT_IGNORE = ['/dist'];

export default base =>
  class ESNextTranspiler extends base {
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
          intro: `Transpiling resource...`,
          outro: `Resource transpiled`
        },
        environment
      );

      if (transpilationOccurred) {
        await this.$emit('transpilationOccurred');
      }
    }

    async _transpileOrCopy(files, environment = {}) {
      const directory = this.$getParent().$getCurrentDirectory();
      const srcDirectory = resolve(directory, this.source);
      const destination = this.destination.replace('${format}', this.format); // eslint-disable-line no-template-curly-in-string
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
    }

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
    }

    async initialize({gitignore}) {
      if (this.$isRoot()) {
        // This initialization method works only with child properties
        return;
      }

      if (this.$getIsUnpublishable() === undefined) {
        this.$setIsUnpublishable(true);
      }

      const root = this.$getRoot();
      const directory = root.$getCurrentDirectory();

      if (root.$implementation === './src') {
        root.$implementation = './dist';
        const implementationFile = join(directory, 'src', 'index.js');
        if (existsSync(implementationFile)) {
          let code = readFileSync(implementationFile, 'utf8');
          if (code.startsWith('module.exports = base =>\n')) {
            code = 'export default base =>\n' + code.slice('module.exports = base =>\n'.length);
            writeFileSync(implementationFile, code);
          }
        }
      }

      if (root.isJSNPMPackageResource) {
        if (root.main === './src/index.js') {
          root.main = './dist/index.js';
        }
        if (isEqual(root.files, ['./src'])) {
          root.files = ['./dist'];
        }
      }

      if (gitignore) {
        GitIgnore.load(directory)
          .add(GIT_IGNORE)
          .save();
      }

      await root['@build']();

      await root.$save();
    }
  };

function setFileExtension(file, extension) {
  return file.slice(0, -extname(file).length) + '.' + extension;
}
