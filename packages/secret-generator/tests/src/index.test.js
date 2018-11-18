import {sortedIndex} from 'lodash';

import {generateSecret, CHARACTERS} from '../../..';

describe('@resdir/secret-generator', () => {
  test('generate secrets of different size', () => {
    expect(generateSecret().length).toBe(48);
    expect(generateSecret(10).length).toBe(10);
    expect(generateSecret(100).length).toBe(100);
    expect(generateSecret(1000).length).toBe(1000);
  });

  test('detect collisions', () => {
    let collisions = 0;

    const secrets = [];
    for (let i = 0; i < 50000; i++) {
      const secret = generateSecret();
      if (i > 0) {
        const index = sortedIndex(secrets, secret);
        if (secrets[index] === secret) {
          collisions++;
        }
        secrets.splice(index, 0, secret);
      } else {
        secrets.push(secret);
      }
    }

    expect(collisions).toBe(0);
  });

  test('check distribution', () => {
    // Stolen from https://github.com/ai/nanoid/blob/master/test/generate.test.js

    const COUNT = 100000;
    const LENGTH = 48;

    const counters = {};

    for (let i = 0; i < COUNT; i++) {
      const secret = generateSecret(LENGTH);
      for (const char of secret) {
        if (!counters[char]) {
          counters[char] = 0;
        }
        counters[char] += 1;
      }
    }

    const chars = Object.keys(counters);

    expect(chars).toHaveLength(CHARACTERS.length);

    for (const char of chars) {
      const distribution = (counters[char] * CHARACTERS.length) / (COUNT * LENGTH);
      expect(distribution).toBeCloseTo(1, 1);
    }
  });
});
