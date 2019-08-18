import {format} from 'util';
import sleep from 'sleep-promise';
import debugModule from 'debug';

const debug = debugModule('js-bundler-example');

class Base {
  async formatGreeting(target = 'Universe') {
    console.log('<Base>');
    await sleep(1000);
    return format('Hello, %s!', target);
  }
}

export class Person extends Base {
  async formatGreeting(target = 'World') {
    console.log('<Person>');
    await sleep(1000);
    return await super.formatGreeting(target);
  }
}

export function Hello() {
  return <h1>Hello</h1>;
}

(async () => {
  debug('Starting example...');
  const person = new Person();
  const greeting = await person.formatGreeting();
  console.log(greeting);
  debug('Example ended');
})().catch(err => console.error(err));
