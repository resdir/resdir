const chalk = require('chalk');

module.exports = base =>
  class Simple extends base {
    hello({color}) {
      console.log(chalk[color]('Hello, World!'));
    }
  };
