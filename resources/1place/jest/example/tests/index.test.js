const Person = require('..');

describe('Person', () => {
  test('formatGreeting()', () => {
    const person = new Person();
    expect(person.formatGreeting()).toBe('Hello, World!');
    expect(person.formatGreeting('Mars')).toBe('Hello, Mars!');
  });
});
