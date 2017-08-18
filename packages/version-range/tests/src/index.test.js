import VersionRange from '../..';

describe('VersionRange', () => {
  test('validation', () => {
    expect(() => new VersionRange()).not.toThrow();
    expect(() => new VersionRange('1.2.3')).not.toThrow();
    expect(() => new VersionRange('1.2.3.4')).toThrow();
    expect(() => new VersionRange('^1.2.3')).not.toThrow();
    expect(() => new VersionRange('^1.2.3,<=2.2.2')).toThrow();
    expect(() => new VersionRange('^1.2.3,~2.2.2')).toThrow();
    expect(() => new VersionRange('>=1.2.3')).not.toThrow();
    expect(() => new VersionRange('>=1.2.3,>=1.2.7')).toThrow();
    expect(() => new VersionRange('>=1.2.3,<2.0.0')).not.toThrow();
    expect(() => new VersionRange('>=1.2.3 <2.0.0')).not.toThrow();
    expect(() => new VersionRange('>=1.2.3,<=1.2.7,<=1.3.0')).toThrow();
    expect(() => new VersionRange('1.2.3,!1.2.7')).toThrow();
    expect(() => new VersionRange('>=1.2.3,!1.2.7')).not.toThrow();
    expect(() => new VersionRange('>=1.2.3 !1.2.7')).not.toThrow();
  });

  test('\'exact\' version', () => {
    const range = new VersionRange('1.2.3');
    expect(range.toString()).toBe('1.2.3');
    expect(range.includes('1.2.2')).toBe(false);
    expect(range.includes('1.2.3')).toBe(true);
    expect(range.includes('1.2.4')).toBe(false);
    expect(range.toJSON()).toBe('1.2.3');
    expect(() => range.getInclusiveBegin()).toThrow();
    expect(() => range.getInclusiveEnd()).toThrow();
  });

  test('\'any\' range', () => {
    const range = new VersionRange();
    expect(range.toString()).toBe('');
    expect(range.includes('0.1.2')).toBe(true);
    expect(range.includes('5.6.7-beta.1')).toBe(true);
    expect(range.toJSON()).toBeUndefined();
    expect(() => range.getInclusiveBegin()).toThrow();
    expect(() => range.getInclusiveEnd()).toThrow();
  });

  test('\'tilde\' range', () => {
    const range = new VersionRange('~1.2.3');
    expect(range.toString()).toBe('~1.2.3');
    expect(range.includes('1.2.3')).toBe(true);
    expect(range.includes('1.2.9')).toBe(true);
    expect(range.includes('0.5.1')).toBe(false);
    expect(range.includes('1.2.1')).toBe(false);
    expect(range.includes('1.3.0')).toBe(false);
    expect(range.simplify().toString()).toBe('>=1.2.3,<=1.999999999.999999999');
    expect(range.getInclusiveBegin()).toBe('1.2.3');
    expect(range.getInclusiveEnd()).toBe('1.999999999.999999999');

    const range2 = new VersionRange('~0.5.1');
    expect(range2.toString()).toBe('~0.5.1');
    expect(range2.includes('0.5.1')).toBe(true);
    expect(range2.includes('0.5.12')).toBe(true);
    expect(range2.includes('0.4.1')).toBe(false);
    expect(range2.includes('0.5.0')).toBe(false);
    expect(range2.includes('0.6.0')).toBe(false);
    expect(range2.simplify().toString()).toBe('>=0.5.1,<=0.5.999999999');
    expect(range2.getInclusiveBegin()).toBe('0.5.1');
    expect(range2.getInclusiveEnd()).toBe('0.5.999999999');
  });

  test('\'caret\' range', () => {
    const range = new VersionRange('^1.2.3');
    expect(range.toString()).toBe('^1.2.3');
    expect(range.includes('1.2.3')).toBe(true);
    expect(range.includes('1.2.9')).toBe(true);
    expect(range.includes('1.8.0')).toBe(true);
    expect(range.includes('0.5.1')).toBe(false);
    expect(range.includes('1.2.0')).toBe(false);
    expect(range.includes('2.0.0')).toBe(false);
    expect(range.simplify().toString()).toBe('>=1.2.3,<=1.999999999.999999999');
    expect(range.getInclusiveBegin()).toBe('1.2.3');
    expect(range.getInclusiveEnd()).toBe('1.999999999.999999999');

    const range2 = new VersionRange('^0.5.2');
    expect(range2.toString()).toBe('^0.5.2');
    expect(range2.includes('0.5.2')).toBe(true);
    expect(range2.includes('0.5.12')).toBe(true);
    expect(range2.includes('0.4.1')).toBe(false);
    expect(range2.includes('0.5.1')).toBe(false);
    expect(range2.includes('0.6.0')).toBe(false);
    expect(range2.simplify().toString()).toBe('>=0.5.2,<=0.999999999.999999999');
    expect(range2.getInclusiveBegin()).toBe('0.5.2');
    expect(range2.getInclusiveEnd()).toBe('0.999999999.999999999');
  });

  test('\'before\' range', () => {
    const range = new VersionRange('<2.0.0');
    expect(range.toString()).toBe('<2.0.0');
    expect(range.includes('0.1.2')).toBe(true);
    expect(range.includes('1.0.0')).toBe(true);
    expect(range.includes('1.20.5')).toBe(true);
    expect(range.includes('2.0.0')).toBe(false);
    expect(range.includes('2.0.1')).toBe(false);
    expect(range.simplify().toString()).toBe('<=1.999999999.999999999');
    expect(() => range.getInclusiveBegin()).toThrow();
    expect(range.getInclusiveEnd()).toBe('1.999999999.999999999');

    const range2 = new VersionRange('<=2.0.0');
    expect(range2.toString()).toBe('<=2.0.0');
    expect(range2.includes('1.20.5')).toBe(true);
    expect(range2.includes('2.0.0')).toBe(true);
    expect(range2.includes('2.0.1')).toBe(false);
    expect(range2.simplify().toString()).toBe('<=2.0.0');
    expect(() => range2.getInclusiveBegin()).toThrow();
    expect(range2.getInclusiveEnd()).toBe('2.0.0');

    expect(new VersionRange('<3.3.3').simplify().toString()).toBe('<=3.3.2');
    expect(new VersionRange('<3.3.0').simplify().toString()).toBe('<=3.2.999999999');
    expect(new VersionRange('<3.0.0').simplify().toString()).toBe('<=2.999999999.999999999');
    expect(() => new VersionRange('<0.0.0').simplify()).toThrow();
  });

  test('\'after\' range', () => {
    const range = new VersionRange('>2.0.0');
    expect(range.toString()).toBe('>2.0.0');
    expect(range.includes('1.20.5')).toBe(false);
    expect(range.includes('2.0.0')).toBe(false);
    expect(range.includes('2.0.1')).toBe(true);
    expect(range.includes('3.0.0')).toBe(true);
    expect(range.simplify().toString()).toBe('>=2.0.1');
    expect(range.getInclusiveBegin()).toBe('2.0.1');
    expect(() => range.getInclusiveEnd()).toThrow();

    const range2 = new VersionRange('>=2.0.0');
    expect(range2.toString()).toBe('>=2.0.0');
    expect(range2.includes('1.20.5')).toBe(false);
    expect(range2.includes('2.0.0')).toBe(true);
    expect(range2.includes('3.0.0')).toBe(true);
    expect(range2.simplify().toString()).toBe('>=2.0.0');
    expect(range2.getInclusiveBegin()).toBe('2.0.0');
    expect(() => range2.getInclusiveEnd()).toThrow();
  });

  test('\'between\' range', () => {
    const range = new VersionRange('>=2.0.0,<3.0.0');
    expect(range.toString()).toBe('>=2.0.0,<3.0.0');
    expect(range.includes('1.20.5')).toBe(false);
    expect(range.includes('2.0.0')).toBe(true);
    expect(range.includes('2.3.1')).toBe(true);
    expect(range.includes('3.0.0')).toBe(false);
    expect(range.includes('5.0.0')).toBe(false);
    expect(range.simplify().toString()).toBe('>=2.0.0,<=2.999999999.999999999');
    expect(range.getInclusiveBegin()).toBe('2.0.0');
    expect(range.getInclusiveEnd()).toBe('2.999999999.999999999');
  });

  test('blacklist', () => {
    const range = new VersionRange('^2.0.0,!2.6.6,!2.7.7');
    expect(range.toString()).toBe('^2.0.0,!2.6.6,!2.7.7');
    expect(range.includes('1.20.5')).toBe(false);
    expect(range.includes('2.0.0')).toBe(true);
    expect(range.includes('2.5.1')).toBe(true);
    expect(range.includes('2.6.6')).toBe(false);
    expect(range.includes('2.7.7')).toBe(false);
    expect(range.includes('3.0.0')).toBe(false);
  });
});
