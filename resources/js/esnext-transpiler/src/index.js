import {join, resolve, relative, extname} from 'path';
import {readFileSync, writeFileSync, existsSync, statSync, chmodSync} from 'fs';
import {isEqual} from 'lodash';
import {copy, readFile, outputFile, emptyDirSync} from 'fs-extra';
import isDirectory from 'is-directory';
import {transform} from 'babel-core';
import {task, formatPath} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';

const GIT_IGNORE = ['/dist'];

export default base =>
  class ESNextTranspiler extends base {
    async run({file}, {event, verbose, quiet, debug}) {
      const files = [];

      if (file) {
        files.push(file); // TODO: Handle multiple files
      }

      if (event && event.name === 'after:@fileModified') {
        if (!event.arguments.file) {
          throw new Error('\'file\' event argument is missing');
        }
        files.push(event.arguments.file);
        quiet = true;
      }

      await task(
        async () => {
          await this._transpileOrCopy(files, {verbose, quiet});
        },
        {
          intro: `Transpiling resource...`,
          outro: `Resource transpiled`,
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

    async '@initialize'({gitignore, ...args}) {
      await super['@initialize'](args);

      if (this.$isRoot()) {
        // This initialization method works only with child properties
        return;
      }

      if (this.$unpublishable === undefined) {
        this.$unpublishable = true;
      }

      if (!this.$getChild('run').$getListenedEvents()) {
        this.$getChild('run').$setListenedEvents(['after:@build', 'after:@fileModified']);
      }

      const root = this.$getRoot();
      const directory = root.$getCurrentDirectory();

      if (root.$implementation === './src/resource.js') {
        root.$implementation = './dist/resource.js';
        const implementationFile = join(directory, 'src', 'resource.js');
        if (existsSync(implementationFile)) {
          let code = readFileSync(implementationFile, 'utf8');
          if (code.startsWith('module.exports = base =>\n')) {
            code = 'export default base =>\n' + code.slice('module.exports = base =>\n'.length);
            writeFileSync(implementationFile, code);
          }
        }
      }

      if (root.isJSPackageResource) {
        if (root.main.$serialize() === './src/index.js') {
          await root.$setChild('main', './dist/index.js');
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