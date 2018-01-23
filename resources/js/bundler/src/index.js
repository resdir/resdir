import {join, resolve} from 'path';
import {outputFile, pathExists, rename} from 'fs-extra';
import {task, formatCode, formatDim} from '@resdir/console';
import {rollup} from 'rollup';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import globals from 'rollup-plugin-node-globals';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import {minify} from 'uglify-es';
import bytes from 'bytes';

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

export default base =>
  class ESNextBundler extends base {
    async run(_input, environment) {
      if (!this.entryFile) {
        throw new Error(`${formatCode('entryFile')} attribute is missing`);
      }

      if (!this.bundleFile) {
        throw new Error(`${formatCode('bundleFile')} attribute is missing`);
      }

      await task(
        async progress => {
          const startingTime = Date.now();

          const directory = this.$getCurrentDirectory();

          if (this.optimize) {
            if (await pathExists(join(directory, 'node_modules'))) {
              await rename(
                join(directory, 'node_modules'),
                join(directory, 'node_modules.original')
              );
              if (await pathExists(join(directory, 'node_modules.clean-install'))) {
                await rename(
                  join(directory, 'node_modules.clean-install'),
                  join(directory, 'node_modules')
                );
              }
              await this.$getRoot()
                .$getChild('dependencies')
                .install({}, environment);
            }
          }

          try {
            const entryFile = resolve(directory, this.entryFile);
            const bundleFile = resolve(directory, this.bundleFile);

            const browser = !(this.target === 'node' || this.target === 'aws-lambda');

            const warnings = [];

            const plugins = [
              nodeResolve({browser, preferBuiltins: !browser}),
              commonjs(), // {include: '/**/node_modules/**'}
              json()
            ];

            if (browser) {
              plugins.push(globals());
            }

            if (this.optimize) {
              plugins.unshift(replace({'process.env.NODE_ENV': JSON.stringify('production')}));
              plugins.push(uglify({}, minify));
            }

            let external;
            if (this.target === 'aws-lambda') {
              external = id => id === 'aws-sdk' || id.startsWith('aws-sdk/');
            }

            const rollupConfig = {
              input: entryFile,
              plugins,
              external,
              onwarn(warning) {
                if (warning.code === 'UNRESOLVED_IMPORT') {
                  if (NODE_BUILT_IN_MODULES.includes(warning.source)) {
                    return; // Ignore Node built-in modules
                  }
                }
                warnings.push(warning);
              }
            };

            const bundle = await rollup(rollupConfig);

            let format = this.format;
            if (format === 'esm') {
              format = 'es';
            }
            const result = await bundle.generate({format, name: this.name});

            for (const warning of warnings) {
              if (environment['@debug']) {
                console.dir(warning, {depth: null, colors: true});
              } else {
                console.warn(warning.toString());
              }
            }

            await outputFile(bundleFile, result.code);

            const elapsedTime = Date.now() - startingTime;

            progress.setOutro(`Bundle generated ${formatDim('(' + bytes(result.code.length) + ', ' + elapsedTime + 'ms)')}`);
          } finally {
            if (this.optimize) {
              if (await pathExists(join(directory, 'node_modules.original'))) {
                await rename(
                  join(directory, 'node_modules'),
                  join(directory, 'node_modules.clean-install')
                );
                await rename(
                  join(directory, 'node_modules.original'),
                  join(directory, 'node_modules')
                );
              }
            }
          }
        },
        {
          intro: 'Generating bundle...',
          outro: 'Bundle generated'
        },
        environment
      );
    }
  };
