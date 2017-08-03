import {formatHello} from '../../dist';

describe('resdir/example', () => {
  test('formatHello()', async () => {
    expect(formatHello()).toBe('Hello, World!');
    expect(formatHello('Manu')).toBe('Hello, Manu!');
  });
});
