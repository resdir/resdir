const chalk = require('chalk');

module.exports = () => ({
  hello({color}) {
    console.log(chalk[color]('Hello, World!'));
  }
});
