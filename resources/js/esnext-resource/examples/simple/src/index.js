import {green} from 'chalk';

export default base =>
  class Simple extends base {
    hello() {
      console.log(green('Hello, World!'));
    }
  };
