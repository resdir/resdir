import {join} from 'path';
import {emptyDirSync} from 'fs-extra';
import tempDir from 'temp-dir';
import {Resource} from 'run-core';
import {loadFile} from 'run-common';

describe('js/package', () => {
  let Package;
  let tempDirectory;

  beforeAll(() => {
    Package = Resource.$load('../', {directory: __dirname});
    tempDirectory = join(tempDir, 'js-package-test');
    emptyDirSync(tempDirectory);
  });

  test('package.json file synchronization', () => {
    const directory = join(tempDirectory, 'package-file-sync');
    emptyDirSync(directory);

    const pkg = Package.$create({
      $name: 'resdir/my-package',
      $version: '1.0.0',
      $description: 'My awesome package',
      $author: 'mvila@me.com',
      $license: 'MIT',
      npmName: 'my-package'
    });

    expect(pkg.$getFile()).toBeUndefined();
    pkg.$save(directory);
    expect(pkg.$getFile()).toBeDefined();

    const resourceDefinition = loadFile(pkg.$getFile(), {parse: true});
    expect(resourceDefinition).toEqual({
      $name: 'resdir/my-package',
      $version: '1.0.0',
      $description: 'My awesome package',
      $author: 'mvila@me.com',
      $license: 'MIT',
      npmName: 'my-package'
    });

    const packageDefinition = loadFile(join(directory, 'package.json'), {parse: true});
    const managed = packageDefinition.$managed;
    expect(managed).toBeDefined();
    expect(managed.properties).toBeInstanceOf(Array);
    expect(managed.properties).toContain('name');
    delete packageDefinition.$managed;
    expect(packageDefinition).toEqual({
      name: 'my-package',
      version: '1.0.0',
      description: 'My awesome package',
      author: 'mvila@me.com',
      license: 'MIT'
    });
  });
});
