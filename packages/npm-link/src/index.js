import {resolve, join, relative} from 'path';
import {existsSync} from 'fs';
import {removeSync, ensureSymlink} from 'fs-extra';
import {load} from '@resdir/file-manager';

export function run() {
  const currentDirectory = process.cwd();

  let packageDirectory = process.argv[2];

  if (!packageDirectory) {
    throw new Error('\'path\' argument is missing');
  }

  packageDirectory = resolve(currentDirectory, packageDirectory);

  let name;

  const packageFile = join(packageDirectory, 'package.json');
  const pkg = load(packageFile, {throwIfNotFound: false});
  if (pkg) {
    name = pkg.name;
  }

  if (!name) {
    const resourceFile = join(packageDirectory, '@resource.json');
    const resourceDefinition = load(resourceFile, {throwIfNotFound: false});
    if (resourceDefinition) {
      name = resourceDefinition.name;
    }
  }

  if (!name) {
    const resourceFile = join(packageDirectory, '@resource.json5');
    const resourceDefinition = load(resourceFile, {throwIfNotFound: false});
    if (resourceDefinition) {
      name = resourceDefinition.name;
    }
  }

  if (!name) {
    throw new Error('Can\'t determine package name');
  }

  const modulesDirectory = join(currentDirectory, 'node_modules');

  if (!existsSync(modulesDirectory)) {
    throw new Error('\'node_modules\' directory not found in the current directory');
  }

  const linkFile = join(modulesDirectory, name);

  removeSync(linkFile);

  ensureSymlink(relative(currentDirectory, packageDirectory), linkFile);

  console.log(`'${name}' linked`);
}
