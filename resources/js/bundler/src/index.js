import {join, resolve, isAbsolute} from 'path';
import {tmpdir} from 'os';
import {
  readFile,
  outputFile as writeFile,
  remove,
  ensureDir,
  pathExists,
  rename,
  stat
} from 'fs-extra';
import {task, print, formatCode, formatDim} from '@resdir/console';
import GitIgnore from '@resdir/gitignore-manager';
import {createClientError} from '@resdir/error';
import {rollup} from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import babel from 'rollup-plugin-babel';
import globals from 'rollup-plugin-node-globals';
import replace from '@rollup/plugin-replace';
import strip from '@rollup/plugin-strip';
import builtins from 'rollup-plugin-node-builtins';
import {terser} from 'rollup-plugin-terser';
import bytes from 'bytes';

const babelPresetEnv = require.resolve('@babel/preset-env');
const babelPresetReact = require.resolve('@babel/preset-react');
const babelPluginClassProperties = require.resolve('@babel/plugin-proposal-class-properties');
const babelPluginPrivateMethods = require.resolve('@babel/plugin-proposal-private-methods');
const babelPluginDecorators = require.resolve('@babel/plugin-proposal-decorators');

const GIT_IGNORE = ['/node_modules.*'];

const NODE_BUILT_IN_MODULES = [
  'process',
  'events',
  'stream',
  'util',
  'path',
  'buffer',
  'querystring',
  'url',
  'string_decoder',
  'punycode',
  'http',
  'https',
  'os',
  'assert',
  'constants',
  'timers',
  'console',
  'vm',
  'zlib',
  'tty',
  'domain',
  'dns',
  'dgram',
  'child_process',
  'cluster',
  'module',
  'net',
  'readline',
  'repl',
  'tls',
  'fs',
  'crypto'
];

export default () => ({
  async run(_input, environment) {
    if (!this.entry) {
      throw createClientError(`${formatCode('entry')} attribute is missing`);
    }

    if (!this.output) {
      throw createClientError(`${formatCode('output')} attribute is missing`);
    }

    await task(
      async progress => {
        const startingTime = Date.now();
        const directory = this.$getCurrentDirectory();

        try {
          if (this.reinstallDependencies) {
            await this._startReinstallDependencies(environment);
          }

          const entryFile = resolve(directory, this.entry);

          const output = this.output.replace('${format}', this.format); // eslint-disable-line no-template-curly-in-string
          const outputFile = resolve(directory, output);

          // v0.1.x:
          // const browser = !(this.target === 'node' || this.target === 'aws-lambda');

          const browser = !this.targets.node;

          const plugins = [];

          if (this.replacements) {
            plugins.push(replace({values: {...this.replacements}, delimiters: ['', '']}));
          }

          if (browser) {
            plugins.push(builtins());
          }

          const mainFields = ['module', 'main'];
          if (browser) {
            mainFields.unshift('browser');
          }
          plugins.push(nodeResolve({mainFields, preferBuiltins: !browser}));

          if (this.transpile) {
            const babelPresets = [
              [babelPresetEnv, {targets: this.targets, loose: true, modules: false}],
              [babelPresetReact]
            ];

            const babelPlugins = [
              [babelPluginDecorators, {legacy: true}],
              [babelPluginClassProperties, {loose: true}],
              [babelPluginPrivateMethods, {loose: true}]
            ];

            const babelOptions = {
              presets: babelPresets,
              plugins: babelPlugins,
              exclude: '**/node_modules/**',
              babelrc: false
            };

            if (this.generateInlineSourceMaps) {
              babelOptions.sourceMaps = 'inline';
            }

            plugins.push(babel(babelOptions));
          }

          plugins.push(
            commonjs({
              ...(this.ignoreCommonJSModules && {ignore: this.ignoreCommonJSModules}),
              ...(this.commonJSNamedExports && {namedExports: this.commonJSNamedExports})
            })
          );

          plugins.push(json());

          if (browser) {
            plugins.push(globals());
          }

          if (this.removeFunctionCalls) {
            plugins.push(strip({functions: this.removeFunctionCalls}));
          }

          if (this.minify) {
            plugins.push(terser({keep_fnames: true})); // eslint-disable-line camelcase
          }

          const external = [];

          if (this.external) {
            external.push(...this.external);
          }

          if (this.globals) {
            external.push(...Object.keys(this.globals));
          }

          // v0.1.x:
          // if (this.target === 'aws-lambda') {
          //   external.push(id => id === 'aws-sdk' || id.startsWith('aws-sdk/'));
          // }

          const actualExternal = id => {
            for (const ext of external) {
              if (typeof ext === 'function') {
                const result = ext(id);
                if (result) {
                  return true;
                }
              } else if (id === ext) {
                return true;
              }
            }
          };

          const rollupConfig = {
            input: entryFile,
            plugins,
            external: actualExternal,
            onwarn(warning) {
              if (warning.code === 'THIS_IS_UNDEFINED') {
                return;
              }
              if (warning.code === 'UNRESOLVED_IMPORT') {
                if (!browser && NODE_BUILT_IN_MODULES.includes(warning.source)) {
                  return; // Ignore Node built-in modules
                }
              }
              if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
                return;
              }
              if (environment['@debug'] || process.env.DEBUG?.startsWith('resdir')) {
                console.dir(warning, {depth: null, colors: true});
              } else {
                print(warning.toString());
              }
            }
          };

          const bundle = await rollup(rollupConfig);

          let result;

          const temporaryFile = generateTemporaryFile();

          let format = this.format;
          if (format === 'esm') {
            format = 'es';
          }

          const outputOptions = {
            file: temporaryFile,
            format,
            name: this.name,
            globals: this.globals
          };

          if (this.generateInlineSourceMaps) {
            outputOptions.sourcemap = 'inline';
            outputOptions.sourcemapFile = outputFile;
          }

          try {
            await bundle.write(outputOptions);
            result = await readFile(temporaryFile, 'utf8');
          } finally {
            await remove(temporaryFile);
          }

          const isDifferent = !(await isFileEqual(outputFile, result));
          if (isDifferent) {
            await writeFile(outputFile, result);
          }

          const elapsedTime = Date.now() - startingTime;

          const message = isDifferent ? 'Bundle generated' : 'Bundle unmodified';
          const size = Buffer.byteLength(result, 'utf8');
          const info = `(${bytes(size)}, ${elapsedTime}ms)`;
          progress.setOutro(`${message} ${formatDim(info)}`);
        } finally {
          if (this.reinstallDependencies) {
            await this._completeReinstallDependencies(environment);
          }
        }
      },
      {
        intro: 'Generating bundle...',
        outro: 'Bundle generated'
      },
      environment
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
      const gitIgnore = [...GIT_IGNORE];
      let output = this.output;
      if (!isAbsolute(output) && !output.startsWith('..')) {
        if (!output.startsWith('./')) {
          output = './' + output;
        }
        if (output.startsWith('./')) {
          output = output.slice(1);
        }
        gitIgnore.push(output);
      }
      GitIgnore.load(directory)
        .add(gitIgnore)
        .save();
    }
  }
});

function generateTemporaryFile() {
  return join(
    tmpdir(),
    Math.random()
      .toString()
      .slice(2)
  );
}

async function isFileEqual(file, content) {
  if (!(await pathExists(file))) {
    return false;
  }

  const {size} = await stat(file);
  if (size !== Buffer.byteLength(content, 'utf8')) {
    return false;
  }

  const fileContent = await readFile(file, 'utf8');
  if (fileContent !== content) {
    return false;
  }

  return true;
}
