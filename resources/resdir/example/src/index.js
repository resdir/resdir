import chalk from 'chalk';

export default base =>
  class Simple extends base {
    hello({color}) {
      console.log(chalk[color](formatHello()));
    }
  };

export function formatHello(target = 'World') {
  return `Hello, ${target}!`;
}
