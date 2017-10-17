import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';

export default {
  input: 'dist/version-property.js',
  output: {
    file: 'bundles/version-property.js',
    format: 'cjs'
  },
  plugins: [nodeResolve(), commonjs(), json()]
};
