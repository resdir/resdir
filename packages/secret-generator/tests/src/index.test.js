import {sortedIndex} from 'lodash';

import generateSecret from '../..';

describe('@resdir/secret-generator', () => {
  test('generate secrets of different size', () => {
    expect(generateSecret().length).toBe(32);
    expect(generateSecret(10).length).toBe(10);
    expect(generateSecret(100).length).toBe(100);
    expect(generateSecret(1000).length).toBe(1000);
  });

  test('detect collisions', () => {
    const secrets = [];
    let collisions = 0;
    for (let i = 0; i < 100000; i++) {
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
});
