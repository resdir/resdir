import {join} from 'path';
import {existsSync, unlinkSync} from 'fs';
import {entries, difference} from 'lodash';
import {formatString, formatPath} from '@resdir/console';
import {createClientError} from '@resdir/error';
import {load, save} from '@resdir/file-manager';
import {getJSON} from '@resdir/http-client';
import {execute} from '@resdir/process-manager';
import LocalCache from '@resdir/local-cache';
import resolvePNPMStorePath from '@pnpm/store-path';
import createPNPMFetcher from '@pnpm/default-fetcher';
import createPNPMResolver from '@pnpm/default-resolver';
import createPNPMStore from 'package-store';
import {install as pnpmInstall} from 'supi';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const NPM_REGISTRY_CACHE_TIME = 60 * 1000; // 1 minute
export const PACKAGE_FILENAME = 'package.json';
const DEPENDENCIES_DIRECTORY = 'node_modules';

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

export async function installPackage(
  directory,
  {production, useLockfile, optimizeDiskSpace, clientDirectory} = {},
  environment
) {
  if (optimizeDiskSpace) {
    await installPackageUsingPNPM(
      directory,
      {production, useLockfile, clientDirectory},
      environment
    );
  } else {
    await installPackageUsingNPM(directory, {production, useLockfile}, environment);
  }
}

export async function updateDependencies(
  directory,
  {useLockfile, optimizeDiskSpace, clientDirectory} = {},
  environment
) {
  if (optimizeDiskSpace) {
    await updateDependenciesUsingPNPM(directory, {useLockfile, clientDirectory}, environment);
  } else {
    await updateDependenciesUsingNPM(directory, {useLockfile}, environment);
  }
}

export async function publishPackage(directory, {access} = {}, environment) {
  const args = ['publish'];
  if (access) {
    args.push('--access');
    args.push(access);
  }
  await execNPM(args, {directory}, environment);
}

export async function getCurrentDependencyVersion(directory, name, {throwIfNotFound = true}) {
  const version = await _getCurrentDependencyVersion(directory, name);
  if (!version && throwIfNotFound) {
    throw createClientError(`Dependency ${formatString(name)} not found (directory: ${formatPath(directory)})`);
  }
  return version;
}

async function _getCurrentDependencyVersion(directory, name) {
  const dependencyDirectory = join(...[directory, DEPENDENCIES_DIRECTORY, ...name.split('/')]);
  const file = join(dependencyDirectory, PACKAGE_FILENAME);
  const pkg = load(file, {throwIfNotFound: false});
  return pkg && pkg.version;
}

// ### npm registry ###

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
        throw createClientError(`Package not found in npm registry: ${formatString(name)}`);
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

// ### npm ###

async function installPackageUsingNPM(directory, {production, useLockfile}, environment) {
  let args = ['prune'];
  if (production) {
    args.push('--production');
  }
  await execNPM(args, {directory}, environment);

  args = ['install'];
  if (production) {
    args.push('--production');
  }
  if (!useLockfile) {
    args.push('--no-package-lock');
  }
  await execNPM(args, {directory}, environment);
}

export async function updateDependenciesUsingNPM(directory, {useLockfile} = {}, environment) {
  const args = ['update', '--no-save'];

  if (!useLockfile) {
    args.push('--no-package-lock');
  }

  await execNPM(args, {directory}, environment);
}

export async function execNPM(args, options, environment) {
  // TODO: Include NPM has a dependency
  const command = 'npm'; // require.resolve('npm/bin/npm-cli.js');
  args = [...args];
  await execute(command, args, {...options, commandName: 'npm'}, environment);
}

// ### pnpm ###

async function installPackageUsingPNPM(
  directory,
  {production, useLockfile, clientDirectory},
  environment
) {
  const options = await buildPNPMInstallOptions(
    directory,
    {production, useLockfile, clientDirectory},
    environment
  );
  return await pnpmInstall(options);
}

async function updateDependenciesUsingPNPM(directory, {useLockfile, clientDirectory}, environment) {
  const options = await buildPNPMInstallOptions(
    directory,
    {updateMode: true, useLockfile, clientDirectory},
    environment
  );
  return await pnpmInstall(options);
}

async function buildPNPMInstallOptions(
  directory,
  {updateMode, production, useLockfile, clientDirectory},
  _environment
) {
  if (!directory) {
    throw new Error('\'directory\' is missing');
  }

  if (!clientDirectory) {
    throw new Error('\'clientDirectory\' is missing');
  }

  const storePath = await resolvePNPMStorePath(directory, join(clientDirectory, 'pnpm-store'));

  // I am not sure about the following options
  // I just tried to guess them from pnpm code
  const options = {
    prefix: directory,
    store: storePath,
    production: true,
    development: !production,
    optional: true,
    shrinkwrap: Boolean(useLockfile),
    update: updateMode,
    progress: true,
    registry: NPM_REGISTRY_URL,
    fetchRetries: 2,
    fetchRetryFactor: 10,
    fetchRetryMintimeout: 10000,
    fetchRetryMaxtimeout: 60000,
    strictSsl: true,
    tag: 'latest',
    unicode: true,
    metaCache: new Map(),
    rawNpmConfig: {registry: NPM_REGISTRY_URL}
  };

  const resolve = createPNPMResolver(options);
  const fetchers = createPNPMFetcher(options);
  const storeController = await createPNPMStore(resolve, fetchers, {store: storePath});

  return {...options, storeController};
}

// ### Yarn ###

// export async function _installPackageUsingYarn(
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

// export async function execYarn(args, options, environment) {
//   const command = require.resolve('yarn/bin/yarn.js');
//   args = [...args, '--no-progress', '--no-emoji', '--non-interactive'];
//   await execute(command, args, {...options, commandName: 'yarn'}, environment);
// }
