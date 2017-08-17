import Version from '../..';

describe('Version', () => {
  test('emptiness', () => {
    expect(() => new Version()).toThrow();
    expect(() => new Version('')).toThrow();
    expect(() => new Version('1.0.0')).not.toThrow();
  });

  test('validation', () => {
    expect(() => new Version('1.0.0')).not.toThrow();
    expect(() => new Version('1.0.0.0')).toThrow();
    expect(() => new Version('^1.0.0')).toThrow();
  });

  test('normalization', () => {
    expect(Version.normalize(undefined)).toBeUndefined();
    expect(Version.normalize('1.0.0')).toBeInstanceOf(Version);
    expect(Version.normalize('1.0.0').toString()).toBe('1.0.0');
    const version = new Version('1.0.0');
    expect(Version.normalize(version)).toBe(version);
    expect(() => Version.normalize(123)).toThrow();
  });

  test('bumping', () => {
    expect(new Version('1.0.0').bump().toString()).toBe('1.0.1');
    expect(new Version('1.0.0').bump('patch').toString()).toBe('1.0.1');
    expect(new Version('1.0.5').bump('minor').toString()).toBe('1.1.0');
    expect(new Version('1.5.0').bump('major').toString()).toBe('2.0.0');
  });

  test('stringification', () => {
    expect(new Version('1.2.3').toJSON()).toBe('1.2.3');
    expect(new Version('1.2.3').toString()).toBe('1.2.3');
  });

  test('implicit conversion', () => {
    expect('v' + new Version('1.2.3')).toBe('v1.2.3');
  });

  test('serialization', () => {
    expect(new Version('1.2.3').toArray()).toEqual([1, 2, 3]);
    expect(new Version('0.0.123').toArray()).toEqual([0, 0, 123]);
    expect(new Version('0.1.0-alpha.1').toArray()).toEqual([0, 1, 0, 'alpha', 1]);
  });

  test('deserialization', () => {
    expect(Version.fromArray([1, 2, 3]).toString()).toBe('1.2.3');
    expect(Version.fromArray([0, 0, 123]).toString()).toBe('0.0.123');
    expect(Version.fromArray([0, 1, 0, 'alpha', 1]).toString()).toBe('0.1.0-alpha.1');
    expect(() => Version.fromArray([0, 1])).toThrow();
  });
});
