import chalk from 'chalk';

export default base =>
  class Simple extends base {
    hello({color}, environment) {
      console.log(chalk[color](formatHello(undefined, environment)));
    }
  };

export function formatHello(target = 'World', environment) {
  let message = `Hello, ${target}!`;
  if (environment && environment['@verbose']) {
    message = message.toUpperCase();
  }
  return message;
}
