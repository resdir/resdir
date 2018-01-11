import {resolve} from 'path';
import {outputFile} from 'fs-extra';
import {task, formatDim} from '@resdir/console';
import {rollup} from 'rollup';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
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
      await task(
        async progress => {
          const startingTime = Date.now();

          const directory = this.$getCurrentDirectory();
          const entryFile = resolve(directory, this.entryFile);
          const bundleFile = resolve(directory, this.bundleFile);

          const warnings = [];

          const rollupConfig = {
            input: entryFile,
            plugins: [
              babel({
                exclude: '/**/node_modules/**',
                presets: [
                  [
                    require.resolve('@babel/preset-env'),
                    {
                      targets: this.targets,
                      loose: true,
                      modules: false
                    }
                  ],
                  [require.resolve('@babel/preset-stage-3'), {loose: true}]
                ]
              }),
              nodeResolve(),
              commonjs({
                include: '/**/node_modules/**'
              }),
              json()
            ],
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

          const result = await bundle.generate({format: this.format, name: 'bundle'});

          for (const warning of warnings) {
            if (environment['@debug']) {
              console.dir(warning, {depth: null, colors: true});
            } else {
              console.warn(warning.toString());
            }
          }

          await outputFile(bundleFile, result.code);

          const elapsedTime = Date.now() - startingTime;

          progress.setOutro(
            `Bundle generated ${formatDim(
              '(' + bytes(result.code.length) + ', ' + elapsedTime + 'ms)'
            )}`
          );
        },
        {
          intro: 'Generating bundle...',
          outro: 'Bundle generated'
        },
        environment
      );
    }
  };
