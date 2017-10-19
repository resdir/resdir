import chalk from 'chalk';

export default base =>
  class Simple extends base {
    hello({color}, {verbose}) {
      console.log(chalk[color](formatHello(undefined, {verbose})));
    }
  };

export function formatHello(target = 'World', {verbose} = {}) {
  let message = `Hello, ${target}!`;
  if (verbose) {
    message = message.toUpperCase();
  }
  return message;
}
