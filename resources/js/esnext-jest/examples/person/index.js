const {format} = require('util');

module.exports = class Person {
  formatGreeting(who = 'World') {
    return format('Hello, %s!', who);
  }
};
