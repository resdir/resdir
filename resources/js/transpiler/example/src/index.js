import {format} from 'util';
import {upperFirst} from 'lodash';
import sleep from 'sleep-promise';

class Base {
  async formatGreeting(target = 'Universe') {
    console.log('<Base>');
    await sleep(1000);
    return format('Hello, %s!', upperFirst(target));
  }
}

export class Person extends Base {
  async formatGreeting(target = 'World') {
    console.log('<Person>');
    await sleep(1000);
    return await super.formatGreeting(target);
  }
}

(async () => {
  const person = new Person();
  const greeting = await person.formatGreeting();
  console.log(greeting);
})().catch(err => console.error(err));
