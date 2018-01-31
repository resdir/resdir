import {Version, compareVersions} from '../../..';

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

  test('reading parts', () => {
    expect(new Version('1.2.3').getMajor()).toBe(1);
    expect(new Version('1.2.3').getMinor()).toBe(2);
    expect(new Version('1.2.3').getPatch()).toBe(3);
    expect(new Version('1.2.3').getPreRelease()).toBeUndefined();
    expect(new Version('1.2.3-alpha.1').getPreRelease()).toEqual(['alpha', 1]);
  });

  test('bumping', () => {
    expect(new Version('1.0.0').bump().toString()).toBe('1.0.1');
    expect(new Version('1.0.0').bump('patch').toString()).toBe('1.0.1');
    expect(new Version('1.0.5').bump('minor').toString()).toBe('1.1.0');
    expect(new Version('1.5.0').bump('major').toString()).toBe('2.0.0');
  });

  test('comparison', () => {
    expect(new Version('1.0.0').compareTo(new Version('1.1.0'), '<')).toBe(true);
    expect(new Version('1.0.0').compareTo('1.1.0', '<')).toBe(true);
    expect(compareVersions('1.0.0', '<', '1.1.0')).toBe(true);
    expect(compareVersions('1.1.0', '<', '1.1.0')).toBe(false);
    expect(compareVersions('1.1.0', '<=', '1.1.0')).toBe(true);
    expect(compareVersions('1.0.0', '>', '1.1.0')).toBe(false);
    expect(compareVersions('1.2.0', '>', '1.1.0')).toBe(true);
    expect(compareVersions('1.2.0', '=', '1.2.0')).toBe(true);
    expect(compareVersions('1.2.0', '!=', '1.3.0')).toBe(true);
  });

  test('stringification', () => {
    expect(new Version('1.2.3').toJSON()).toBe('1.2.3');
    expect(new Version('1.2.3').toString()).toBe('1.2.3');
    expect(String(new Version('1.2.3'))).toBe('1.2.3');
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
