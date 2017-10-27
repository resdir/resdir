import {join} from 'path';
import {writeFileSync} from 'fs';
import {rollup} from 'rollup';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';

export default base =>
  class Builder extends base {
    async bundle() {
      const bundle = await rollup({
        input: join(__dirname, 'index.js'),
        output: {
          file: join(__dirname, '..', 'bundle.js'),
          format: 'cjs'
        },
        plugins: [nodeResolve(), commonjs({ignore: ['spawn-sync']}), json()]
      });

      const result = await bundle.generate({
        format: 'cjs'
      });

      writeFileSync(join(__dirname, '..', 'bundle.js'), result.code);
    }
  };
