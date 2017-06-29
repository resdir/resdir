import {join, resolve, relative, extname} from 'path';
import {statSync, chmodSync} from 'fs';
import {copy, readFile, outputFile, emptyDirSync} from 'fs-extra';
import isDirectory from 'is-directory';
import {transform} from 'babel-core';
import {task, formatString, formatPath} from 'run-common';

export default base =>
  class Transpiler extends base {
    async transpile(...files) {
      const {verbose, quiet, debug} = files.pop();

      const root = this.$getRoot();
      const packageName = root.npmName || root.$name;
      const formattedPackageName = packageName ? formatString(packageName) + ' ' : '';

      await task(
        async () => {
          await this._transpileOrCopy(files);
        },
        {
          intro: `Transpiling ${formattedPackageName}package...`,
          outro: `Package ${formattedPackageName}transpiled`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async _transpileOrCopy(files) {
      const directory = this.$getDirectory();
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
          throw new Error(
            `Cannot build a file (${formatPath(
              srcFile
            )}) located outside of the source directory (${formatPath(srcDirectory)})`
          );
        }

        const destFile = join(destDirectory, relativeFile);

        await copy(srcFile, destFile, {
          preserveTimestamps: true,
          filter: file => {
            const relativeFile = relative(srcDirectory, file);
            if (isDirectory.sync(file)) {
              const targetDir = join(destDirectory, relativeFile);
              emptyDirSync(targetDir);
              return true;
            }
            const extension = extname(file);
            if (!extensions.includes(extension)) {
              return true;
            }
            transpilableFiles.push(relativeFile);
            return false;
          }
        });
      }

      await this._transpile(srcDirectory, destDirectory, transpilableFiles);
    }

    async _transpile(srcDirectory, destDirectory, files) {
      for (const file of files) {
        const srcFile = join(srcDirectory, file);
        const destFile = join(destDirectory, file);

        let code = await readFile(srcFile, 'utf8');
        const {mode} = statSync(srcFile);

        ({code} = transform(code, {
          presets: [
            [
              require.resolve('babel-preset-env'),
              {targets: {node: 6}, loose: true, exclude: ['transform-regenerator']}
            ]
          ],
          plugins: [
            require.resolve('babel-plugin-transform-class-properties'),
            require.resolve('babel-plugin-transform-object-rest-spread')
          ],
          sourceMaps: 'inline'
        }));

        await outputFile(destFile, code);
        chmodSync(destFile, mode);
      }
    }
  };
