import {join} from 'path';
import {existsSync, unlinkSync} from 'fs';
import {entries, difference} from 'lodash';
import {formatString} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {getJSON} from '@resdir/http-client';
import {execute} from '@resdir/process-manager';
import LocalCache from '@resdir/local-cache';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const NPM_REGISTRY_CACHE_TIME = 60 * 1000; // 1 minute
export const PACKAGE_FILENAME = 'package.json';

export function updatePackageFile(directory, definition) {
  let status;

  const file = join(directory, PACKAGE_FILENAME);

  let pkg = load(file, {throwIfNotFound: false});
  if (pkg) {
    status = 'UPDATED';
  } else {
    pkg = {};
    status = 'CREATED';
  }

  let managed = pkg['@managed'];
  if (!managed) {
    managed = {
      warning:
        'This file contains properties managed by a Resource. You should not modify them directly or use a command such as `npm install <name>`.'
    };
  }

  const managedProperties = new Set(managed.properties);

  for (const [key, value] of entries(definition)) {
    managedProperties.add(key);
    pkg[key] = value;
  }

  managed.properties = Array.from(managedProperties);

  delete pkg['@managed']; // Put the @managed property at the end of the object
  pkg['@managed'] = managed;

  save(file, pkg);

  return {status};
}

export function removePackageFile(directory) {
  const file = join(directory, PACKAGE_FILENAME);
  if (existsSync(file)) {
    unlinkSync(file);
  }
}

export function removePackageFileIfFullyManaged(directory) {
  const file = join(directory, PACKAGE_FILENAME);

  const pkg = load(file, {throwIfNotFound: false}) || {};

  const packageProperties = Object.keys(pkg);
  const managedProperties = (pkg['@managed'] && pkg['@managed'].properties) || [];
  const remainingProperties = difference(packageProperties, managedProperties, ['@managed']);

  if (remainingProperties.length === 0) {
    unlinkSync(file);
  }
}

export async function installPackage(directory, {production, useLockfile} = {}, environment) {
  // TODO: try to use https://github.com/pnpm/pnpm

  const args = ['install'];

  if (production) {
    args.push('--production');
  }

  if (!useLockfile) {
    args.push('--no-package-lock');
  }

  await execNPM(args, {directory}, environment);
}

// export async function installPackage(
//   directory,
//   {production, useLockfile, modulesDirectory} = {},
//   environment
// ) {
//   const args = ['install'];
//   if (production) {
//     args.push('--production');
//   }
//   if (!useLockfile) {
//     args.push('--no-lockfile');
//   }
//   if (modulesDirectory) {
//     args.push('--modules-folder');
//     args.push(modulesDirectory);
//   }
//   await execYarn(args, {directory}, environment);
// }

export async function publishPackage(directory, {access} = {}, environment) {
  const args = ['publish'];
  if (access) {
    args.push('--access');
    args.push(access);
  }
  await execNPM(args, {directory}, environment);
}

// export async function execYarn(args, options, environment) {
//   const command = require.resolve('yarn/bin/yarn.js');
//   args = [...args, '--no-progress', '--no-emoji', '--non-interactive'];
//   await execute(command, args, {...options, commandName: 'yarn'}, environment);
// }

export async function execNPM(args, options, environment) {
  // TODO: Include NPM has a dependency
  const command = 'npm'; // require.resolve('npm/bin/npm-cli.js');
  args = [...args];
  await execute(command, args, {...options, commandName: 'npm'}, environment);
}

export async function fetchNPMRegistry(name, {useCache, throwIfNotFound = true} = {}) {
  const url = NPM_REGISTRY_URL + '/' + name.replace('/', '%2F');
  try {
    const {body} = await getJSON(url, {
      headers: {Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'},
      timeout: 15 * 1000,
      cache: useCache && getNPMRegistryCache()
    });
    return body;
  } catch (err) {
    if (err.status === 404) {
      if (throwIfNotFound) {
        throw new Error(`Package not found in npm registry: ${formatString(name)}`);
      }
      return undefined;
    }
    throw err;
  }
}

let npmRegistryCache;
function getNPMRegistryCache() {
  if (!npmRegistryCache) {
    npmRegistryCache = new LocalCache({time: NPM_REGISTRY_CACHE_TIME});
  }
  return npmRegistryCache;
}
