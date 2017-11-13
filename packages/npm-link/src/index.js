import {resolve, join, relative, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {removeSync, ensureSymlinkSync} from 'fs-extra';
import {load} from '@resdir/file-manager';
import isDirectory from 'is-directory';
import minimist from 'minimist';

export function run() {
  const argv = minimist(process.argv, {
    string: ['directory'],
    alias: {
      directory: ['dir', 'd']
    }
  });

  let currentDirectory = process.cwd();
  if (argv.directory) {
    currentDirectory = resolve(currentDirectory, argv.directory);
  }

  const packageName = process.argv[2];

  if (!packageName) {
    throw new Error('\'packageName\' is missing');
  }

  const config = loadConfig(currentDirectory);

  const packageDirectory = findPackage(config.directories, packageName);

  if (!packageDirectory) {
    throw new Error(`Package '${packageName}' not found`);
  }

  const modulesDirectory = join(currentDirectory, 'node_modules');

  if (!existsSync(modulesDirectory)) {
    throw new Error('\'node_modules\' directory not found in the current directory');
  }

  const linkFile = join(modulesDirectory, packageName);

  removeSync(linkFile);

  ensureSymlinkSync(relative(dirname(linkFile), packageDirectory), linkFile);

  console.log(`'${packageName}' linked`);
}

function findPackage(directories, name) {
  for (const directory of directories) {
    const entries = readdirSync(directory);
    for (let entry of entries) {
      entry = join(directory, entry);
      if (!isDirectory.sync(entry)) {
        continue;
      }
      const packageDirectory = entry;
      const packageFile = join(packageDirectory, 'package.json');
      const pkg = load(packageFile, {throwIfNotFound: false});
      if (!pkg) {
        continue;
      }
      if (pkg.name === name) {
        return packageDirectory;
      }
    }
  }
}

function loadConfig(directory) {
  const file = join(directory, '.npm-link.json');
  if (existsSync(file)) {
    const config = load(file);
    const configDirectory = dirname(file);
    config.directories = config.directories.map(directory => resolve(configDirectory, directory));
    return config;
  }

  const parentDirectory = join(directory, '..');
  if (parentDirectory !== directory) {
    return loadConfig(parentDirectory);
  }

  throw new Error('Config file not found');
}
