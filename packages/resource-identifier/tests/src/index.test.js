import {getResourceNamespace, getResourceName, validateResourceIdentifier} from '../..';

describe('@resdir/resource-identifier', () => {
  test('getResourceNamespace()', () => {
    expect(getResourceNamespace('resdir/hello')).toBe('resdir');
    expect(getResourceNamespace(undefined)).toBeUndefined();
    expect(getResourceNamespace('resdir')).toBeUndefined();
    expect(getResourceNamespace('resdir/hello/world')).toBeUndefined();
    expect(getResourceNamespace('/hello')).toBeUndefined();
  });

  test('getResourceName()', () => {
    expect(getResourceName('resdir/hello')).toBe('hello');
    expect(getResourceName('hello')).toBe('hello');
    expect(getResourceName(undefined)).toBeUndefined();
    expect(getResourceName('resdir/hello/world')).toBeUndefined();
    expect(getResourceName('/hello')).toBeUndefined();
  });

  test('validateResourceIdentifier()', () => {
    expect(validateResourceIdentifier('resdir/hello')).toBe(true);
    expect(validateResourceIdentifier('resdir/hello-world')).toBe(true);
    expect(validateResourceIdentifier('resdir/123')).toBe(true);
    expect(() => validateResourceIdentifier('')).toThrow();
    expect(() => validateResourceIdentifier('resdir/Hello')).toThrow();
    expect(() => validateResourceIdentifier('resdir/hello-')).toThrow();
    expect(() => validateResourceIdentifier('resdir/hello*world')).toThrow();
    expect(() => validateResourceIdentifier('resdir/-hello')).toThrow();
    expect(() => validateResourceIdentifier('resdir/hello--world')).toThrow();
    expect(() => validateResourceIdentifier('hello')).toThrow();
    expect(() => validateResourceIdentifier('resdir/')).toThrow();
    expect(() => validateResourceIdentifier('/hello')).toThrow();
    expect(() => validateResourceIdentifier('resdir/hello/hi')).toThrow();
  });
});
