import {format} from 'util';

export class Person {
  formatGreeting(who = 'World') {
    return format('Hello, %s!', who);
  }
}
