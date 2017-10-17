import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';

export default {
  input: 'dist/resource.js',
  output: {
    file: 'bundles/resource.js',
    format: 'cjs'
  },
  plugins: [nodeResolve(), commonjs(), json()]
};
