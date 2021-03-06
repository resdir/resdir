import {resolve, join, relative, dirname} from 'path';
import {existsSync, readdirSync} from 'fs';
import {ensureDirSync, removeSync, ensureSymlinkSync} from 'fs-extra';
import {compact} from 'lodash';
import {load} from '@resdir/file-manager';
import isDirectory from 'is-directory';
import minimist from 'minimist';

export function run() {
  const argv = minimist(process.argv);

  const directory = argv._[2] || './';

  const currentDirectory = resolve(process.cwd(), directory);

  const config = loadConfig(currentDirectory);

  const modulesDirectory = join(currentDirectory, 'node_modules');

  let packageNames;
  const packageName = argv._[3];
  if (packageName) {
    packageNames = [packageName];
  } else {
    packageNames = loadPackageNames(currentDirectory);
  }

  for (const packageName of packageNames) {
    const packageDirectory = findPackage(config.directories, packageName);
    if (!packageDirectory) {
      continue;
    }

    ensureDirSync(modulesDirectory);
    const linkFile = join(modulesDirectory, packageName);
    removeSync(linkFile);
    ensureSymlinkSync(relative(dirname(linkFile), packageDirectory), linkFile);

    console.log(`${directory}: '${packageName}' linked`);
  }
}

function loadConfig(directory) {
  const file = join(directory, '.npm-link.json');
  if (existsSync(file)) {
    const config = load(file);
    const configDirectory = dirname(file);
    config.directories = config.directories.map(directory => {
      const resolvedDirectory = resolve(configDirectory, directory);
      if (existsSync(resolvedDirectory)) {
        return resolvedDirectory;
      }
      console.warn(
        `[WARNING] A directory specified in the config file doesn't exist: ${directory}`
      );
      return undefined;
    });
    config.directories = compact(config.directories);
    return config;
  }

  const parentDirectory = join(directory, '..');
  if (parentDirectory !== directory) {
    return loadConfig(parentDirectory);
  }

  throw new Error('Config file not found');
}

function loadPackageNames(directory) {
  const file = findResourceFile(directory);
  const resource = load(file);
  let dependencies =
    resource.dependencies ||
    (resource['@unpublishable'] && resource['@unpublishable'].dependencies);
  if (typeof dependencies !== 'object') {
    return [];
  }
  if ('@value' in dependencies) {
    dependencies = dependencies['@value'];
  }
  return Object.keys(dependencies);
}

function findResourceFile(directory) {
  let file = join(directory, '@resource.json');
  if (existsSync(file)) {
    return file;
  }
  file = join(directory, 'package.json');
  if (existsSync(file)) {
    return file;
  }
  throw new Error('Resource file not found');
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
