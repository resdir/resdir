import {validateResourceDescription} from '../../..';

describe('@resdir/resource-description', () => {
  test('validateResourceDescription()', () => {
    expect(validateResourceDescription('aa', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceDescription('a'.repeat(100), {throwIfInvalid: false})).toBe(true);
    expect(validateResourceDescription('a', {throwIfInvalid: false})).toBe(false);
    expect(validateResourceDescription('a'.repeat(101), {throwIfInvalid: false})).toBe(false);
    expect(validateResourceDescription(undefined, {throwIfInvalid: false})).toBe(false);
    expect(validateResourceDescription(1, {throwIfInvalid: false})).toBe(false);
    expect(() => validateResourceDescription('a')).toThrow();
  });
});
