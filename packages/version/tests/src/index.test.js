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
    expect(Version.normalize('1.0.0')).toBeInstanceOf(Version);
    expect(Version.normalize('1.0.0').toString()).toBe('1.0.0');
    const version = new Version('1.0.0');
    expect(Version.normalize(version)).toBe(version);
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

  test('conversion', () => {
    expect('v' + new Version('1.2.3')).toBe('v1.2.3');
  });

  test('serialization', () => {
    expect(Version.serialize('1.2.3')).toBe('00001.00002.00003');
    expect(Version.serialize('0.0.123')).toBe('00000.00000.00123');
    expect(Version.serialize('0.1.0-alpha.1')).toBe('00000.00001.00000-alpha.1');
    expect(() => Version.serialize('0.0.99999')).not.toThrow();
    expect(Version.serialize('0.0.99999')).toBe('00000.00000.99999');
    expect(() => Version.serialize('0.0.100000')).toThrow();
  });

  test('deserialization', () => {
    expect(Version.deserialize('00001.00002.00003')).toBe('1.2.3');
    expect(Version.deserialize('00000.00000.00123')).toBe('0.0.123');
    expect(Version.deserialize('00000.00001.00000-alpha.1')).toBe('0.1.0-alpha.1');
    expect(() => Version.deserialize('00000.00000.99999')).not.toThrow();
    expect(Version.deserialize('00000.00000.99999')).toBe('0.0.99999');
    expect(() => Version.deserialize('00000.00000.100000')).toThrow();
  });
});
