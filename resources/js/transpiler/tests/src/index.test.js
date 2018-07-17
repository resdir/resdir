import {join, resolve} from 'path';
import {emptyDirSync, pathExistsSync, outputFile} from 'fs-extra';
import tempDir from 'temp-dir';
import {Resource} from 'run-core';
import {load, save} from '@resdir/file-manager';

jest.setTimeout(10 * 1000);

const CODE = `
import {format} from 'util';

export class Person {
  formatGreeting(who = 'World') {
    return format('Hello, %s!', who);
  }
}
`;

describe('js/transpiler', () => {
  let tempDirectory;

  beforeAll(() => {
    tempDirectory = join(tempDir, 'js-esnext-transpiler-test');
    emptyDirSync(tempDirectory);
  });

  test('transpilation', async () => {
    const directory = join(tempDirectory, 'person');
    emptyDirSync(directory);

    const sourceCodeFile = join(directory, 'src', 'index.js');
    await outputFile(sourceCodeFile, CODE);

    const resourceFile = join(directory, '@resource.json');
    const definition = {
      transpiler: {
        '@import': resolve(__dirname, '../../..')
      }
    };
    save(resourceFile, definition);

    const Person = await Resource.$load(directory);
    await Person.transpiler.run(undefined, {'@quiet': true});

    const destinationDirectory = join(directory, 'dist', 'cjs');
    expect(pathExistsSync(destinationDirectory)).toBe(true);

    const destinationCodeFile = join(destinationDirectory, 'index.js');
    const destinationCode = load(destinationCodeFile, {parse: false});

    // After transpilation there should be no more 'import' statement
    expect(destinationCode).not.toContain('import');
  });
});
