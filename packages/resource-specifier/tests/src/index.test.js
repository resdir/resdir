import {parseResourceSpecifier} from '../..';

describe('@resdir/resource-specifier', () => {
  test('parseResourceSpecifier()', () => {
    expect(parseResourceSpecifier('resdir/hello').identifier).toBe('resdir/hello');
    expect(parseResourceSpecifier('resdir/hello').versionRange.toString()).toBe('');

    expect(parseResourceSpecifier('resdir/hello#^1.0.0').identifier).toBe('resdir/hello');
    expect(parseResourceSpecifier('resdir/hello#^1.0.0').versionRange.toString()).toBe('^1.0.0');

    expect(parseResourceSpecifier('./example').location).toBe('./example');
    expect(parseResourceSpecifier('/Users/bob/dev/example').location).toBe(
      '/Users/bob/dev/example'
    );
    expect(parseResourceSpecifier('https://registry.resdir.com').location).toBe(
      'https://registry.resdir.com'
    );

    expect(() => parseResourceSpecifier('resdir')).toThrow();
    expect(() => parseResourceSpecifier('resdir/-hello-')).toThrow();
    expect(() => parseResourceSpecifier('resdir/hello@1.2.3.4')).toThrow();
  });
});
