import {validateResourceKey} from '../..';

describe('@resdir/resource-key', () => {
  test('validateResourceKey()', () => {
    expect(validateResourceKey('a', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceKey('a1A_', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceKey('A', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceKey('_', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceKey('_', {throwIfInvalid: false})).toBe(true);
    expect(validateResourceKey('1', {throwIfInvalid: false})).toBe(false);
    expect(validateResourceKey('@import', {throwIfInvalid: false})).toBe(false);
    expect(() => validateResourceKey('1')).toThrow();
  });
});
