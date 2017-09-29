import {join} from 'path';
import {entries} from 'lodash';
import {execFile, spawn} from 'child-process-promise';
import {formatString, formatCode, formatPath} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {getJSON} from '@resdir/http-client';
import LocalCache from '@resdir/local-cache';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const NPM_REGISTRY_CACHE_TIME = 60 * 1000; // 1 minute
export const PACKAGE_FILENAME = 'package.json';

export function updatePackageFile(directory, definition) {
  const file = join(directory, PACKAGE_FILENAME);

  let pkg = load(file, {throwIfNotFound: false});
  if (!pkg) {
    pkg = {};
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
}

export async function installPackage(
  directory,
  {production, useLockfile, modulesDirectory, debug} = {}
) {
  const args = ['install'];
  if (production) {
    args.push('--production');
  }
  if (!useLockfile) {
    args.push('--no-lockfile');
  }
  if (modulesDirectory) {
    args.push('--modules-folder');
    args.push(modulesDirectory);
  }
  await execYarn(args, {directory, debug});
}

export async function publishPackage(directory, {access, debug} = {}) {
  const args = ['publish'];
  if (access) {
    args.push('--access');
    args.push(access);
  }
  await execNPM(args, {directory, debug});
}

export async function execYarn(args, options) {
  const command = require.resolve('yarn/bin/yarn.js');
  args = [...args, '--no-progress', '--no-emoji', '--non-interactive'];
  await exec(command, args, {...options, commandName: 'yarn'});
}

export async function execNPM(args, options) {
  const command = require.resolve('npm/bin/npm-cli.js');
  args = [...args, '--no-shrinkwrap'];
  await exec(command, args, {...options, commandName: 'npm'});
}

async function exec(command, args, {directory, commandName, debug} = {}) {
  try {
    if (debug) {
      await spawn(command, args, {cwd: directory, stdio: 'inherit'});
    } else {
      await execFile(command, args, {cwd: directory});
    }
  } catch (err) {
    const error = new Error(
      `An error occured while executing ${commandName ?
        formatCode(commandName) :
        formatPath(command)}`
    );
    error.capturedStandardError = err.stderr;
    throw error;
  }
}

export async function fetchNPMRegistry(name, {throwIfNotFound = true} = {}) {
  const url = NPM_REGISTRY_URL + '/' + name.replace('/', '%2F');
  try {
    const {body} = await getJSON(url, {
      headers: {Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'},
      timeout: 15 * 1000,
      cache: getNPMRegistryCache()
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
