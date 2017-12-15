import {join, resolve} from 'path';
import {emptyDirSync, pathExistsSync, outputFile} from 'fs-extra';
import tempDir from 'temp-dir';
import {Resource} from 'run-core';
import {load, save} from '@resdir/file-manager';

const CODE = `
import {format} from 'util';

export class Person {
  formatGreeting(who = 'World') {
    return format('Hello, %s!', who);
  }
}
`;

describe('js/esnext-transpiler', () => {
  let tempDirectory;

  beforeAll(() => {
    tempDirectory = join(tempDir, 'js-esnext-transpiler-test');
    emptyDirSync(tempDirectory);
  });

  test('transpilation', async () => {
    const directory = join(tempDirectory, 'person');
    emptyDirSync(directory);

    const srcCodeFile = join(directory, 'src', 'index.js');
    await outputFile(srcCodeFile, CODE);

    const resourceFile = join(directory, '@resource.json');
    const definition = {
      id: 'resdir/js-esnext-transpiler-person-test',
      transpiler: {
        '@import': resolve(__dirname, '../..')
      }
    };
    save(resourceFile, definition);

    const Person = await Resource.$load(directory);
    await Person.transpiler.run(undefined, {'@quiet': true});

    const distDirectory = join(directory, 'dist');
    expect(pathExistsSync(distDirectory)).toBe(true);

    const distCodeFile = join(directory, 'dist', 'index.js');
    const distCode = load(distCodeFile, {parse: false});

    // After transpilation there should be no more 'import' statement
    expect(distCode).not.toContain('import');
  });
});
