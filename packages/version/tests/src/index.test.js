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

  test('bumping', () => {
    expect(new Version('1.0.0').bump().toString()).toBe('1.0.1');
    expect(new Version('1.0.0').bump('patch').toString()).toBe('1.0.1');
    expect(new Version('1.0.0').bump('minor').toString()).toBe('1.1.0');
    expect(new Version('1.0.0').bump('major').toString()).toBe('2.0.0');
  });

  test('serialization', () => {
    expect(new Version('1.2.3').toJSON()).toBe('1.2.3');
    expect(new Version('1.2.3').toString()).toBe('1.2.3');
  });

  test('conversion', () => {
    expect('v' + new Version('1.2.3')).toBe('v1.2.3');
  });
});
