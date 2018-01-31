import {validateNamespace, isGenericNamespace, isReservedNamespace} from '../../..';

describe('@resdir/namespace', () => {
  test('validateNamespace()', () => {
    expect(validateNamespace('resdir')).toBe(true);
    expect(validateNamespace('123')).toBe(true);
    expect(validateNamespace('abc-123')).toBe(true);
    expect(validateNamespace('a')).toBe(true);
    expect(validateNamespace('1234567890123456789012345678901234567890')).toBe(true);
    expect(() => validateNamespace('')).toThrow();
    expect(() => validateNamespace('A')).toThrow();
    expect(() => validateNamespace('a/b')).toThrow();
    expect(() => validateNamespace('a*b')).toThrow();
    expect(() => validateNamespace('hello-')).toThrow();
    expect(() => validateNamespace('-hello')).toThrow();
    expect(() => validateNamespace('hello--world')).toThrow();
    expect(() => validateNamespace('12345678901234567890123456789012345678901')).toThrow();
    expect(validateNamespace('A', {throwIfInvalid: false})).toBe(false);
  });

  test('isGenericNamespace()', () => {
    expect(isGenericNamespace('chic')).toBe(true);
    expect(isGenericNamespace('abc123')).toBe(false);
  });

  test('isReservedNamespace()', () => {
    expect(isReservedNamespace('connect-github-account')).toBe(true);
    expect(isReservedNamespace('chic')).toBe(false);
  });
});
