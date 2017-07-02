import {join} from 'path';
import {entries} from 'lodash';
import {execFile, spawn} from 'child-process-promise';
import {loadFile, saveFile, fetchJSON, formatString, formatCode, formatPath} from 'run-common';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
export const PACKAGE_FILENAME = 'package.json';

export function updatePackageFile(directory, definition) {
  const file = join(directory, PACKAGE_FILENAME);

  let pkg = loadFile(file, {throwIfNotFound: false, parse: true});
  if (!pkg) {
    pkg = {};
  }

  let managed = pkg.$managed;
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

  delete pkg.$managed; // Put the $managed property at the end of the object
  pkg.$managed = managed;

  saveFile(file, pkg, {stringify: true});
}

export async function installPackage(directory, {production, useLockfile, debug} = {}) {
  const args = ['install'];
  if (production) {
    args.push('--production');
  }
  if (!useLockfile) {
    args.push('--no-lockfile');
  }
  await execYarn(args, {directory, debug});
}

export async function execYarn(args, options) {
  const command = require.resolve('yarn/bin/yarn.js');
  args = [...args, '--no-progress', '--no-emoji', '--non-interactive'];
  await exec(command, args, {...options, commandName: 'yarn'});
}

// export async function execNPM(args, options) {
//   const command = require.resolve('npm/bin/npm-cli.js');
//   args = [...args, '--no-shrinkwrap'];
//   await exec(command, args, {...options, commandName: 'npm'});
// }

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

export async function fetchNPMRegistry(name) {
  const url = NPM_REGISTRY_URL + '/' + name.replace('/', '%2F');
  try {
    return await fetchJSON(url, {
      headers: {Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'},
      timeout: 15 * 1000,
      cacheTime: 60 * 1000
    });
  } catch (err) {
    if (err.httpStatus === 404) {
      throw new Error(`Package not found in npm registry: ${formatString(name)}`);
    }
    throw err;
  }
}
