import {join} from 'path';
import {emptyDirSync, pathExistsSync} from 'fs-extra';
import tempDir from 'temp-dir';
import {Resource} from 'run-core';
import {loadFile} from 'run-common';

// TODO: replace with jest.setTimeout() when Jest 21 is available
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000; // eslint-disable-line

describe('js/dependencies', () => {
  let Package;
  let tempDirectory;

  beforeAll(async () => {
    Package = await Resource.$create({dependencies: {'@type': '../..'}}, {directory: __dirname});
    tempDirectory = join(tempDir, 'js-dependencies-test');
    emptyDirSync(tempDirectory);
  });

  test('creation', async () => {
    expect(await (await Package.$create()).dependencies.count()).toBe(0);

    expect(await (await Package.$create({dependencies: []})).dependencies.count()).toBe(0);

    const pkg = await Package.$create({dependencies: ['json5@^1.0.0', 'lodash']});
    expect(await pkg.dependencies.count()).toBe(2);
    expect(await pkg.dependencies.includes('json5')).toBe(true);
    expect(await pkg.dependencies.includes('lodash')).toBe(true);
    expect(await pkg.dependencies.includes('babel')).toBe(false);
  });

  test('normalization and serialization', async () => {
    expect((await Package.$create({dependencies: []})).$serialize()).toBeUndefined();

    expect((await Package.$create({dependencies: ['lodash']})).$serialize()).toEqual({
      dependencies: ['lodash']
    });
  });

  test('add production dependency', async () => {
    const directory = join(tempDirectory, 'add-production');
    emptyDirSync(directory);
    const pkg = await Package.$create({}, {directory});

    expect(await pkg.dependencies.includes('lodash')).toBe(false);
    await pkg.dependencies.add('lodash', {quiet: true});
    expect(await pkg.dependencies.includes('lodash')).toBe(true);

    let resourceDefinition = loadFile(pkg.$getFile(), {parse: true});
    expect(resourceDefinition.dependencies).toHaveLength(1);
    expect(resourceDefinition.dependencies[0]).toMatch(/^lodash@.+/);

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(true);

    await pkg.dependencies.remove('lodash', {quiet: true});
    expect(await pkg.dependencies.includes('lodash')).toBe(false);

    resourceDefinition = loadFile(pkg.$getFile(), {parse: true});
    expect(resourceDefinition.dependencies).toBeUndefined();

    // expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(false);
  });

  test('add development dependency', async () => {
    const directory = join(tempDirectory, 'add-development');
    emptyDirSync(directory);
    const pkg = await Package.$create({}, {directory});

    expect(await pkg.dependencies.includes('lodash')).toBe(false);
    await pkg.dependencies.add('lodash@4.5.1', {development: true, quiet: true});
    expect(await pkg.dependencies.includes('lodash')).toBe(true);

    let resourceDefinition = loadFile(pkg.$getFile(), {parse: true});
    expect(resourceDefinition.dependencies).toHaveLength(1);
    expect(resourceDefinition.dependencies[0]).toEqual({
      name: 'lodash',
      version: '4.5.1',
      type: 'development'
    });

    expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(true);

    await pkg.dependencies.remove('lodash', {quiet: true});
    expect(await pkg.dependencies.includes('lodash')).toBe(false);

    resourceDefinition = loadFile(pkg.$getFile(), {parse: true});
    expect(resourceDefinition.dependencies).toBeUndefined();

    // expect(pathExistsSync(join(directory, 'node_modules', 'lodash'))).toBe(false);
  });
});
