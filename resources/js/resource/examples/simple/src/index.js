const {green} = require('chalk');

module.exports = base =>
  class Simple extends base {
    hello() {
      console.log(green('Hello, World!'));
    }
  };
