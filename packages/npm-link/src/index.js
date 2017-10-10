import {resolve, join, relative} from 'path';
import {readFileSync, existsSync} from 'fs';
import {removeSync, ensureSymlink} from 'fs-extra';

export function run() {
  const currentDirectory = process.cwd();

  let packageDirectory = process.argv[2];

  if (!packageDirectory) {
    throw new Error('\'path\' argument is missing');
  }

  packageDirectory = resolve(currentDirectory, packageDirectory);

  const packageFile = join(packageDirectory, 'package.json');

  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));

  if (!pkg.name) {
    throw new Error('\'pkg.name\' is missing');
  }

  const modulesDirectory = join(currentDirectory, 'node_modules');

  if (!existsSync(modulesDirectory)) {
    throw new Error('\'node_modules\' directory not found in the current directory');
  }

  const linkFile = join(modulesDirectory, pkg.name);

  removeSync(linkFile);

  ensureSymlink(relative(currentDirectory, packageDirectory), linkFile);

  console.log(`'${pkg.name}' linked`);
}
