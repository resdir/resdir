import chalk from 'chalk';
import {print} from '@resdir/console';

export default () => ({
  hello({color}, environment) {
    let message = `Hello, World!`;
    if (environment['@verbose']) {
      message = message.toUpperCase();
    }
    message = chalk[color](message);
    print(message, environment);
  }
});
