import {join, resolve, relative, extname} from 'path';
import {copy, readFile, outputFile, emptyDirSync} from 'fs-extra';
import isDirectory from 'is-directory';
import {transform} from 'babel-core';
import {task, formatString, formatPath} from 'run-common';

export default base =>
  class Package extends base {
    async build(...files) {
      const {verbose, quiet, debug} = files.pop();

      const packageName = this.npmName || this.$name;
      const formattedPackageName = packageName ? formatString(packageName) + ' ' : '';

      await task(
        async () => {
          this._build(files);
        },
        {
          intro: `Building ${formattedPackageName}package...`,
          outro: `Package ${formattedPackageName}built`,
          verbose,
          quiet,
          debug
        }
      );
    }

    async _build(files) {
      const directory = this.$getDirectory();
      const srcDirectory = resolve(directory, this.sourceDirectory);
      const distDirectory = resolve(directory, this.distributionDirectory);
      const extensions = this.transpilation.fileExtensions;

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

        const distFile = join(distDirectory, relativeFile);

        await copy(srcFile, distFile, {
          preserveTimestamps: true,
          filter: file => {
            const relativeFile = relative(srcDirectory, file);
            if (isDirectory.sync(file)) {
              const targetDir = join(distDirectory, relativeFile);
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

      await this.transpile(srcDirectory, distDirectory, transpilableFiles);
    }

    async transpile(srcDirectory, distDirectory, files) {
      for (const file of files) {
        const srcFile = join(srcDirectory, file);
        const distFile = join(distDirectory, file);

        let code = await readFile(srcFile, 'utf8');

        ({code} = transform(code, {
          presets: [
            [
              require.resolve('babel-preset-env'),
              {targets: {node: 6}, loose: true, exclude: ['transform-regenerator']}
            ]
          ],
          plugins: [require.resolve('babel-plugin-transform-object-rest-spread')],
          sourceMaps: 'inline'
        }));

        await outputFile(distFile, code);
      }
    }
  };
