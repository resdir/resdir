import {formatValue} from '../../../dist';

console.log(formatValue({
  '@import': 'resdir/resource',
  company: {
    boss: {
      name: 'John',
      age: 30,
      size: 1.67,
      isCool: true,
      tags: ['nice', 'guy', 'cool', 'awesome', 'peaceful', 'quiet'],
      colors: [],
      location: [{x: 123, y: 456}],
      customInfo: {},
      parent: undefined
    }
  }
}));

console.log();

console.log(formatValue(
  [
    'nice',
    'guy',
    'cool',
    'awesome',
    'peaceful',
    'quiet',
    'nice',
    'guy',
    'cool',
    'awesome',
    'peaceful',
    'quiet'
  ],
  {multiline: false}
));

console.log();

console.log(formatValue({name: 'Manu', age: 45}, {multiline: false}));
