const {join} = require('path');

const {installPackage} = require('../dist/node/cjs');

installPackage(__dirname, {
  optimizeDiskSpace: true,
  clientDirectory: join(__dirname, '.client-directory')
}).catch(err => console.error(err));
