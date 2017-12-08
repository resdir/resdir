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
