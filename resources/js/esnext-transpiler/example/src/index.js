import {format} from 'util';

export class Person {
  async formatGreeting(who = 'World') {
    return format('Hello, %s!', who);
  }
}
