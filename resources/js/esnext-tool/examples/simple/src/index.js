import chalk from 'chalk';

export default base =>
  class Simple extends base {
    hello({color}) {
      console.log(chalk[color]('Hello, World!'));
    }
  };
