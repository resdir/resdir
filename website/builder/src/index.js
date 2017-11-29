import {join, resolve} from 'path';
import {readFileSync, writeFileSync} from 'fs';
import {fromPairs, toPairs} from 'lodash';
import {emptyDir, copy, move, remove} from 'fs-extra';
import {task, formatDim} from '@resdir/console';
import {rollup} from 'rollup';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import globals from 'rollup-plugin-node-globals';
import builtins from 'rollup-plugin-node-builtins';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import bytes from 'bytes';
import revHash from 'rev-hash';

export default base =>
  class Builder extends base {
    async run(_args, {verbose, quiet, debug}) {
      await this.clearDestination();

      const bundleFilename = await this.generateBundle({
        replacements: {
          RESDIR_REGISTRY_URL: this.environment.resdirRegistryURL
        },
        verbose,
        quiet,
        debug
      });

      await this.generateIndexPage({
        replacements: {
          REACT_URL: this.environment.reactURL,
          REACT_DOM_URL: this.environment.reactDOMURL,
          BUNDLE_PATH: '/' + bundleFilename
        },
        verbose,
        quiet,
        debug
      });

      await this.copyAssets({verbose, quiet, debug});
    }

    async clearDestination() {
      await emptyDir(this.getDestinationDirectory());
    }

    async generateIndexPage({replacements, verbose, quiet, debug}) {
      await task(
        async () => {
          let html = readFileSync(join(this.getSourceDirectory(), 'index.html'), 'utf8');
          for (const [key, value] of toPairs(replacements)) {
            // TODO: handle replacement of multiple occurences
            html = html.replace('$' + key + '$', JSON.stringify(value));
          }
          writeFileSync(join(this.getDestinationDirectory(), 'index.html'), html);
        },
        {
          intro: 'Generating index page...',
          outro: 'Index page generated',
          verbose,
          quiet,
          debug
        }
      );
    }

    async copyAssets({verbose, quiet, debug}) {
      await task(
        async () => {
          await copy(
            join(this.getSourceDirectory(), 'images'),
            join(this.getDestinationDirectory(), 'images')
          );
        },
        {
          intro: 'Copying assets...',
          outro: 'Assets copied',
          verbose,
          quiet,
          debug
        }
      );
    }

    async generateBundle({replacements, verbose, quiet, debug}) {
      return await task(
        async progress => {
          const startingTime = Date.now();

          let filename;
          let codeLength;

          if (this.optimize) {
            await move(
              join(this.getSourceDirectory(), 'node_modules'),
              join(this.getSourceDirectory(), 'node_modules.dev')
            );
            const contentResource = await this.constructor.$load(this.getSourceDirectory());
            await contentResource.$getChild('dependencies').install({}, {verbose, quiet, debug});
          }

          try {
            const warnings = [];

            const rollupConfig = {
              input: join(this.getSourceDirectory(), 'src', 'index.js'),
              cache: global.resdirWebsiteBuilderRollupCache,
              external: ['react', 'react-dom', 'prop-types'],
              plugins: [
                replace({
                  include: '/**/reduce-css-calc/dist/parser.js',
                  delimiters: ['', ''],
                  '_token_stack:': '' // Fix https://github.com/zaach/jison/issues/351
                }),
                babel({
                  include: [join(this.getSourceDirectory(), 'src/**')],
                  presets: [
                    [
                      require.resolve('babel-preset-env'),
                      {
                        targets: {ie: 11},
                        loose: true,
                        modules: false,
                        useBuiltIns: true
                      }
                    ]
                  ],
                  plugins: [
                    require.resolve('babel-plugin-external-helpers'),
                    require.resolve('babel-plugin-transform-decorators-legacy'),
                    require.resolve('babel-plugin-transform-class-properties'),
                    require.resolve('babel-plugin-transform-object-rest-spread'),
                    require.resolve('babel-plugin-transform-react-jsx')
                  ]
                }),
                commonjs({
                  namedExports: {
                    [join(this.getSourceDirectory(), 'node_modules/radium/lib/index.js')]: ['Style']
                  }
                }),
                globals(),
                replace({
                  include: join(this.getSourceDirectory(), 'src', 'environment.js'),
                  delimiters: ['$', '$'],
                  ...fromPairs(
                    toPairs(replacements).map(([key, value]) => [key, JSON.stringify(value)])
                  )
                }),
                nodeResolve({browser: true}),
                json(),
                builtins()
              ],
              onwarn(warning) {
                if (
                  (warning.code === 'THIS_IS_UNDEFINED' || warning.code === 'MISSING_EXPORT') &&
                  warning.id.includes('whatwg-fetch')
                ) {
                  return;
                }
                warnings.push(warning);
              }
            };

            if (this.optimize) {
              rollupConfig.plugins.unshift(
                replace({'process.env.NODE_ENV': JSON.stringify('production')})
              );
              rollupConfig.plugins.push(uglify());
            }

            const bundle = await rollup(rollupConfig);

            const result = await bundle.generate({
              format: 'iife',
              name: 'bundle',
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
                'prop-types': 'PropTypes'
              }
            });

            for (const warning of warnings) {
              if (debug) {
                console.dir(warning, {depth: null, colors: true});
              } else {
                console.warn(warning.toString());
              }
            }

            const hash = revHash(result.code);
            filename = `bundle.${hash}.immutable.js`;
            await writeFileSync(join(this.getDestinationDirectory(), filename), result.code);

            codeLength = result.code.length;

            global.resdirWebsiteBuilderRollupCache = bundle;
          } finally {
            if (this.optimize) {
              await remove(join(this.getSourceDirectory(), 'node_modules'));
              await move(
                join(this.getSourceDirectory(), 'node_modules.dev'),
                join(this.getSourceDirectory(), 'node_modules')
              );
            }
          }

          const elapsedTime = Date.now() - startingTime;

          progress.setOutro(
            `Bundle generated ${formatDim('(' + bytes(codeLength) + ', ' + elapsedTime + 'ms)')}`
          );

          return filename;
        },
        {
          intro: 'Generating bundle...',
          outro: 'Bundle generated',
          verbose,
          quiet,
          debug
        }
      );
    }

    getSourceDirectory() {
      return resolve(this.$getCurrentDirectory(), this.sourceDirectory);
    }

    getDestinationDirectory() {
      return resolve(this.$getCurrentDirectory(), this.destinationDirectory);
    }
  };
