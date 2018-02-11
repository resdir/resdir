import {validateResourceName} from '../../..';

describe('@resdir/resource-name', () => {
  test('validateResourceName()', () => {
    expect(validateResourceName('aa', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceName('a'.repeat(50), {throwIfInvalid: false})).toBe(true);
    expect(validateResourceName('a', {throwIfInvalid: false})).toBe(false);
    expect(validateResourceName('a'.repeat(51), {throwIfInvalid: false})).toBe(false);
    expect(validateResourceName(undefined, {throwIfInvalid: false})).toBe(false);
    expect(validateResourceName(1, {throwIfInvalid: false})).toBe(false);
    expect(() => validateResourceName('a')).toThrow();
  });
});
