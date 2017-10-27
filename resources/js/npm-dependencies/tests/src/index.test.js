import {join} from 'path';
import {emptyDirSync, pathExistsSync} from 'fs-extra';
import tempDir from 'temp-dir';
import {Resource} from 'run-core';
import {load} from '@resdir/file-manager';

// TODO: replace with jest.setTimeout() when Jest 21 is available
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000; // eslint-disable-line

describe('js/npm-dependencies', () => {
  let Package;
  let tempDirectory;

  beforeAll(async () => {
    Package = await Resource.$create({dependencies: {'@import': '../..'}}, {directory: __dirname});
    tempDirectory = join(tempDir, 'js-dependencies-test');
    emptyDirSync(tempDirectory);
  });

  test('creation', async () => {
    expect(await (await Package.$extend()).dependencies.count()).toBe(0);

    expect(await (await Package.$extend({dependencies: {}})).dependencies.count()).toBe(0);

    const pkg = await Package.$extend({dependencies: {json5: '^1.0.0', lodash: '2.0.0'}});
    expect(await pkg.dependencies.count()).toBe(2);
    expect(await pkg.dependencies.includes({name: 'json5'})).toBe(true);
    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(true);
    expect(await pkg.dependencies.includes({name: 'babel'})).toBe(false);
  });

  test('normalization and serialization', async () => {
    expect((await Package.$extend({dependencies: {}})).$serialize()).toBeUndefined();
    expect(
      (await Package.$extend({
        dependencies: {json5: '^1.0.0', lodash: '', babel: {version: '6.0.0', type: 'development'}}
      })).$serialize()
    ).toEqual({
      dependencies: {json5: '^1.0.0', lodash: '', babel: {version: '6.0.0', type: 'development'}}
    });

    expect((await Package.$extend({dependencies: []})).$serialize()).toBeUndefined();
    expect(
      (await Package.$extend({
        dependencies: [
          'json5@^1.0.0',
          'lodash',
          {name: 'babel', version: '6.0.0', type: 'development'}
        ]
      })).$serialize()
    ).toEqual({
      dependencies: {json5: '^1.0.0', lodash: '', babel: {version: '6.0.0', type: 'development'}}
    });
  });

  test('add production dependency', async () => {
    const directory = join(tempDirectory, 'add-production');
    emptyDirSync(directory);
    const pkg = await Package.$extend({}, {directory});

    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(false);

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(false);

    await pkg.dependencies.add({specifier: 'lodash'}, {quiet: true});

    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(true);

    let resourceDefinition = load(pkg.$getResourceFile());
    expect(Object.keys(resourceDefinition.dependencies)).toEqual(['lodash']);

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(true);

    await pkg.dependencies.remove({name: 'lodash'}, {quiet: true});

    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(false);

    resourceDefinition = load(pkg.$getResourceFile());
    expect(resourceDefinition.dependencies).toBeUndefined();

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(false);
  });

  test('add development dependency', async () => {
    const directory = join(tempDirectory, 'add-development');
    emptyDirSync(directory);
    const pkg = await Package.$extend({}, {directory});

    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(false);

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(false);

    await pkg.dependencies.add({specifier: 'lodash@4.5.1', development: true}, {quiet: true});

    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(true);

    let resourceDefinition = load(pkg.$getResourceFile());
    expect(resourceDefinition.dependencies.lodash).toEqual({
      version: '4.5.1',
      type: 'development'
    });

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(true);

    await pkg.dependencies.remove({name: 'lodash'}, {quiet: true});

    expect(await pkg.dependencies.includes({name: 'lodash'})).toBe(false);

    resourceDefinition = load(pkg.$getResourceFile());
    expect(resourceDefinition.dependencies).toBeUndefined();

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(false);
  });
});
