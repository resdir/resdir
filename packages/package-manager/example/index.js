const {installPackage} = require('../dist/node/cjs');

installPackage(__dirname).catch(err => console.error(err));
