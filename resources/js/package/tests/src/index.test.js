import {join} from 'path';
import {emptyDirSync} from 'fs-extra';
import tempDir from 'temp-dir';
import {Resource} from 'run-core';
import {loadFile} from 'run-common';

describe('js/package', () => {
  let Package;
  let tempDirectory;

  beforeAll(async () => {
    Package = await Resource.$import('../..', {directory: __dirname});
    tempDirectory = join(tempDir, 'js-package-test');
    emptyDirSync(tempDirectory);
  });

  test('normalization and serialization', async () => {
    expect((await Package.$extend()).$serialize()).toBeUndefined();
    expect((await Package.$extend({main: {}})).$serialize()).toBeUndefined();
    expect((await Package.$extend({main: './index.js'})).$serialize()).toEqual({
      main: './index.js'
    });
    expect((await Package.$extend({main: {es5: './dist', es6: './src'}})).$serialize()).toEqual({
      main: {es5: './dist', es6: './src'}
    });
  });

  test('package.json file synchronization', async () => {
    const directory = join(tempDirectory, 'package-file-sync');
    emptyDirSync(directory);

    const pkg = await Package.$extend({
      name: 'my-package',
      version: '1.0.0',
      description: 'My awesome package',
      author: 'mvila@me.com',
      license: 'MIT',
      main: './index.js',
      bin: {
        run: 'dist/bin/index.js'
      },
      preferGlobal: true
    });

    expect(pkg.$getResourceFile()).toBeUndefined();
    await pkg.$save({directory});
    expect(pkg.$getResourceFile()).toBeDefined();

    const resourceDefinition = loadFile(pkg.$getResourceFile(), {parse: true});
    expect(resourceDefinition).toEqual({
      name: 'my-package',
      version: '1.0.0',
      description: 'My awesome package',
      author: 'mvila@me.com',
      license: 'MIT',
      main: './index.js',
      bin: {
        run: 'dist/bin/index.js'
      },
      preferGlobal: true
    });

    const packageDefinition = loadFile(join(directory, 'package.json'), {parse: true});
    const managed = packageDefinition['@managed'];
    expect(managed).toBeDefined();
    expect(managed.properties).toBeInstanceOf(Array);
    expect(managed.properties).toContain('name');
    delete packageDefinition['@managed'];
    expect(packageDefinition).toEqual({
      name: 'my-package',
      version: '1.0.0',
      description: 'My awesome package',
      author: 'mvila@me.com',
      license: 'MIT',
      main: 'index.js',
      bin: {
        run: 'dist/bin/index.js'
      },
      preferGlobal: true
    });
  });
});
