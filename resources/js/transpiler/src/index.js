import {join, resolve, relative, extname} from 'path';
import {statSync, chmodSync} from 'fs';
import {copy, readFile, outputFile, emptyDirSync} from 'fs-extra';
import isDirectory from 'is-directory';
import {transform} from 'babel-core';
import {task, formatString, formatPath} from '@resdir/console';

export default base =>
  class Transpiler extends base {
    async run({file, verbose, quiet, debug}) {
      let name = this.$getParent().$name;
      if (name) {
        name = formatString(name);
      }

      const files = [];
      if (file) {
        files.push(file); // TODO: Handle multiple files
      }

      await task(
        async () => {
          await this._transpileOrCopy(files, {verbose, quiet});
        },
        {
          intro: `Transpiling ${name ? name : 'resource'}...`,
          outro: `${name ? name : 'Resource'} transpiled`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async _transpileOrCopy(files, {verbose, quiet}) {
      const directory = this.$getParent().$getCurrentDirectory();
      const srcDirectory = resolve(directory, this.source);
      const destDirectory = resolve(directory, this.destination);
      const extensions = this.extensions;

      if (!files.length) {
        files = [srcDirectory];
      }

      const transpilableFiles = [];

      for (const srcFile of files) {
        const relativeFile = relative(srcDirectory, srcFile);
        if (relativeFile.startsWith('..')) {
          if (!quiet) {
            console.warn(
              `Cannot build a file (${formatPath(
                srcFile
              )}) located outside of the source directory (${formatPath(srcDirectory)})`
            );
          }
          continue;
        }

        const destFile = join(destDirectory, relativeFile);

        await copy(srcFile, destFile, {
          preserveTimestamps: true,
          filter: file => {
            const relativeFile = relative(srcDirectory, file);
            if (isDirectory.sync(file)) {
              if (verbose) {
                console.log(`Cleaning ${formatPath(file)}...`);
              }
              const targetDir = join(destDirectory, relativeFile);
              emptyDirSync(targetDir);
              return true;
            }
            const extension = extname(file);
            if (!extensions.includes(extension)) {
              if (verbose) {
                console.log(`Copying ${formatPath(file)}...`);
              }
              return true;
            }
            transpilableFiles.push(relativeFile);
            return false;
          }
        });
      }

      await this._transpile(srcDirectory, destDirectory, transpilableFiles, {verbose});
    }

    async _transpile(srcDirectory, destDirectory, files, {verbose}) {
      const presets = [[require.resolve('babel-preset-env'), {targets: this.targets, loose: true}]];

      const plugins = [
        require.resolve('babel-plugin-transform-class-properties'),
        require.resolve('babel-plugin-transform-object-rest-spread')
      ];

      if (this.transformJSX) {
        plugins.push([
          require.resolve('babel-plugin-transform-react-jsx'),
          {pragma: this.jsxPragma}
        ]);
      }

      const transformOptions = {
        presets,
        plugins,
        sourceMaps: 'inline'
      };

      for (const file of files) {
        const srcFile = join(srcDirectory, file);
        const destFile = join(destDirectory, file);

        if (verbose) {
          console.log(`Transpiling ${formatPath(srcFile)}...`);
        }

        let code = await readFile(srcFile, 'utf8');
        const {mode} = statSync(srcFile);

        ({code} = transform(code, transformOptions));

        await outputFile(destFile, code);
        chmodSync(destFile, mode);
      }
    }
  };
