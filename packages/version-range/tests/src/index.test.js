import VersionRange from '../../..';

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
    expect(() => new VersionRange('!1.2.7')).not.toThrow();
  });

  test('\'EXACT\' range', () => {
    const range = new VersionRange('1.2.3');
    expect(range.type).toBe('EXACT');
    expect(range.toString()).toBe('1.2.3');
    expect(range.includes('1.2.2')).toBe(false);
    expect(range.includes('1.2.3')).toBe(true);
    expect(range.includes('1.2.4')).toBe(false);
    expect(range.findMaximum(['0.5.1', '2.2.3'])).toBeUndefined();
    expect(range.findMaximum(['1.2.3', '2.2.3'])).toBe('1.2.3');
    expect(range.toJSON()).toBe('1.2.3');
    expect(() => range.getInclusiveBegin()).toThrow();
    expect(() => range.getInclusiveEnd()).toThrow();
  });

  test('\'ANY\' range', () => {
    const range = new VersionRange();
    expect(range.type).toBe('ANY');
    expect(range.toString()).toBe('');
    expect(range.includes('0.1.2')).toBe(true);
    expect(range.includes('5.6.7-beta.1')).toBe(true);
    expect(range.findMaximum([])).toBeUndefined();
    expect(range.findMaximum(['1.2.3', '2.2.3', '3.0.0-alpha.1'])).toBe('2.2.3');
    expect(range.toJSON()).toBeUndefined();
    expect(() => range.getInclusiveBegin()).toThrow();
    expect(() => range.getInclusiveEnd()).toThrow();
  });

  test('\'TILDE\' range', () => {
    const range = new VersionRange('~1.2.3');
    expect(range.type).toBe('TILDE');
    expect(range.toString()).toBe('~1.2.3');
    expect(range.includes('1.2.2')).toBe(false);
    expect(range.includes('1.2.3')).toBe(true);
    expect(range.includes('1.2.4')).toBe(true);
    expect(range.includes('1.3.0')).toBe(false);
    expect(range.findMaximum(['1.2.3', '1.2.10', '1.3.0'])).toBe('1.2.10');
    expect(range.findMaximum(['0.3.0', '1.2.1', '1.4.0'])).toBeUndefined();
    expect(range.simplify().toString()).toBe('>=1.2.3,<=1.2.999999999');
    expect(range.getInclusiveBegin()).toBe('1.2.3');
    expect(range.getInclusiveEnd()).toBe('1.2.999999999');

    const range2 = new VersionRange('~1.2');
    expect(range2.type).toBe('TILDE');
    expect(range2.toString()).toBe('~1.2');
    expect(range2.includes('1.1.99')).toBe(false);
    expect(range2.includes('1.2.0')).toBe(true);
    expect(range2.includes('1.2.1')).toBe(true);
    expect(range2.includes('1.3.0')).toBe(false);
    expect(range2.findMaximum(['1.2.1', '1.2.10', '1.3.0'])).toBe('1.2.10');
    expect(range2.findMaximum(['0.3.0', '1.4.0'])).toBeUndefined();
    expect(range2.simplify().toString()).toBe('>=1.2.0,<=1.2.999999999');
    expect(range2.getInclusiveBegin()).toBe('1.2.0');
    expect(range2.getInclusiveEnd()).toBe('1.2.999999999');

    const range3 = new VersionRange('~1');
    expect(range3.type).toBe('TILDE');
    expect(range3.toString()).toBe('~1');
    expect(range3.includes('0.99.99')).toBe(false);
    expect(range3.includes('1.0.0')).toBe(true);
    expect(range3.includes('1.1.0')).toBe(true);
    expect(range3.includes('2.0.0')).toBe(false);
    expect(range3.findMaximum(['1.2.1', '1.7.10', '2.1.0'])).toBe('1.7.10');
    expect(range3.findMaximum(['0.3.0', '2.4.0'])).toBeUndefined();
    expect(range3.simplify().toString()).toBe('>=1.0.0,<=1.999999999.999999999');
    expect(range3.getInclusiveBegin()).toBe('1.0.0');
    expect(range3.getInclusiveEnd()).toBe('1.999999999.999999999');
  });

  test('\'CARET\' range', () => {
    const range = new VersionRange('^1.2.3');
    expect(range.type).toBe('CARET');
    expect(range.toString()).toBe('^1.2.3');
    expect(range.includes('1.2.3')).toBe(true);
    expect(range.includes('1.2.9')).toBe(true);
    expect(range.includes('0.5.1')).toBe(false);
    expect(range.includes('1.2.1')).toBe(false);
    expect(range.includes('1.3.0')).toBe(true);
    expect(range.findMaximum(['1.2.1', '1.7.10', '2.1.0'])).toBe('1.7.10');
    expect(range.findMaximum(['0.3.0', '2.4.0'])).toBeUndefined();
    expect(range.simplify().toString()).toBe('>=1.2.3,<=1.999999999.999999999');
    expect(range.getInclusiveBegin()).toBe('1.2.3');
    expect(range.getInclusiveEnd()).toBe('1.999999999.999999999');

    const range2 = new VersionRange('^0.5.1');
    expect(range2.type).toBe('CARET');
    expect(range2.toString()).toBe('^0.5.1');
    expect(range2.includes('0.5.1')).toBe(true);
    expect(range2.includes('0.5.12')).toBe(true);
    expect(range2.includes('0.4.1')).toBe(false);
    expect(range2.includes('0.5.0')).toBe(false);
    expect(range2.includes('0.6.0')).toBe(false);
    expect(range2.findMaximum(['0.5.3', '0.5.10', '0.6.1'])).toBe('0.5.10');
    expect(range2.findMaximum(['0.5.0', '0.6.0'])).toBeUndefined();
    expect(range2.simplify().toString()).toBe('>=0.5.1,<=0.5.999999999');
    expect(range2.getInclusiveBegin()).toBe('0.5.1');
    expect(range2.getInclusiveEnd()).toBe('0.5.999999999');
  });

  test('\'BEFORE\' range', () => {
    const range = new VersionRange('<2.0.0');
    expect(range.type).toBe('BEFORE');
    expect(range.toString()).toBe('<2.0.0');
    expect(range.includes('0.1.2')).toBe(true);
    expect(range.includes('1.0.0')).toBe(true);
    expect(range.includes('1.20.5')).toBe(true);
    expect(range.includes('2.0.0')).toBe(false);
    expect(range.includes('2.0.1')).toBe(false);
    expect(range.findMaximum(['0.5.3', '1.5.10', '2.6.1'])).toBe('1.5.10');
    expect(range.findMaximum(['2.0.0', '3.0.0'])).toBeUndefined();
    expect(range.simplify().toString()).toBe('<=1.999999999.999999999');
    expect(() => range.getInclusiveBegin()).toThrow();
    expect(range.getInclusiveEnd()).toBe('1.999999999.999999999');

    const range2 = new VersionRange('<=2.0.0');
    expect(range2.type).toBe('BEFORE');
    expect(range2.toString()).toBe('<=2.0.0');
    expect(range2.includes('1.20.5')).toBe(true);
    expect(range2.includes('2.0.0')).toBe(true);
    expect(range2.includes('2.0.1')).toBe(false);
    expect(range2.findMaximum(['1.5.3', '2.0.0', '2.0.1'])).toBe('2.0.0');
    expect(range2.findMaximum(['2.0.1', '2.5.0'])).toBeUndefined();
    expect(range2.simplify().toString()).toBe('<=2.0.0');
    expect(() => range2.getInclusiveBegin()).toThrow();
    expect(range2.getInclusiveEnd()).toBe('2.0.0');

    expect(new VersionRange('<3.3.3').simplify().toString()).toBe('<=3.3.2');
    expect(new VersionRange('<3.3.0').simplify().toString()).toBe('<=3.2.999999999');
    expect(new VersionRange('<3.0.0').simplify().toString()).toBe('<=2.999999999.999999999');
    expect(() => new VersionRange('<0.0.0').simplify()).toThrow();
  });

  test('\'AFTER\' range', () => {
    const range = new VersionRange('>2.0.0');
    expect(range.type).toBe('AFTER');
    expect(range.toString()).toBe('>2.0.0');
    expect(range.includes('1.20.5')).toBe(false);
    expect(range.includes('2.0.0')).toBe(false);
    expect(range.includes('2.0.1')).toBe(true);
    expect(range.includes('3.0.0')).toBe(true);
    expect(range.findMaximum(['0.5.3', '2.5.10', '2.6.1'])).toBe('2.6.1');
    expect(range.findMaximum(['0.5.7', '2.0.0'])).toBeUndefined();
    expect(range.simplify().toString()).toBe('>=2.0.1');
    expect(range.getInclusiveBegin()).toBe('2.0.1');
    expect(() => range.getInclusiveEnd()).toThrow();

    const range2 = new VersionRange('>=2.0.0');
    expect(range2.type).toBe('AFTER');
    expect(range2.toString()).toBe('>=2.0.0');
    expect(range2.includes('1.20.5')).toBe(false);
    expect(range2.includes('2.0.0')).toBe(true);
    expect(range2.includes('3.0.0')).toBe(true);
    expect(range2.findMaximum(['0.5.3', '2.5.10', '2.6.1'])).toBe('2.6.1');
    expect(range2.findMaximum(['0.5.7', '1.9.0'])).toBeUndefined();
    expect(range2.simplify().toString()).toBe('>=2.0.0');
    expect(range2.getInclusiveBegin()).toBe('2.0.0');
    expect(() => range2.getInclusiveEnd()).toThrow();
  });

  test('\'BETWEEN\' range', () => {
    const range = new VersionRange('>=2.0.0,<3.0.0');
    expect(range.type).toBe('BETWEEN');
    expect(range.toString()).toBe('>=2.0.0,<3.0.0');
    expect(range.includes('1.20.5')).toBe(false);
    expect(range.includes('2.0.0')).toBe(true);
    expect(range.includes('2.3.1')).toBe(true);
    expect(range.includes('3.0.0')).toBe(false);
    expect(range.includes('5.0.0')).toBe(false);
    expect(range.findMaximum(['1.2.1', '2.1.10', '2.8.0', '2.1.0'])).toBe('2.8.0');
    expect(range.findMaximum(['1.3.0', '3.0.0'])).toBeUndefined();
    expect(range.simplify().toString()).toBe('>=2.0.0,<=2.999999999.999999999');
    expect(range.getInclusiveBegin()).toBe('2.0.0');
    expect(range.getInclusiveEnd()).toBe('2.999999999.999999999');
  });

  test('exclusions', () => {
    const range = new VersionRange('^2.0.0,!2.6.6,!2.7.7');
    expect(range.exclusions).toEqual(['2.6.6', '2.7.7']);
    expect(range.toString()).toBe('^2.0.0,!2.6.6,!2.7.7');
    expect(range.includes('1.20.5')).toBe(false);
    expect(range.includes('2.0.0')).toBe(true);
    expect(range.includes('2.5.1')).toBe(true);
    expect(range.includes('2.6.6')).toBe(false);
    expect(range.includes('2.7.7')).toBe(false);
    expect(range.includes('3.0.0')).toBe(false);
    expect(range.findMaximum(['1.2.1', '2.5.0', '2.7.7'])).toBe('2.5.0');
    expect(range.findMaximum(['2.6.6', '2.7.7'])).toBeUndefined();

    const range2 = new VersionRange('!2.6.6');
    expect(range2.exclusions).toEqual(['2.6.6']);
    expect(range2.toString()).toBe('!2.6.6');
    expect(range2.includes('0.5.5')).toBe(true);
    expect(range2.includes('2.0.0')).toBe(true);
    expect(range2.includes('2.6.6')).toBe(false);
    expect(range2.includes('3.0.0')).toBe(true);
    expect(range2.findMaximum(['0.6.6', '1.5.5', '2.6.6'])).toBe('1.5.5');
    expect(range2.findMaximum(['2.6.6'])).toBeUndefined();

    expect(new VersionRange().exclusions).toEqual([]);
    expect(new VersionRange('2.0.0').exclusions).toEqual([]);
    expect(new VersionRange('^2.0.0').exclusions).toEqual([]);
    expect(new VersionRange('>=2.0.0').exclusions).toEqual([]);
  });
});
