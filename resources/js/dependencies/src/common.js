import {execFile, spawn} from 'child-process-promise';
import {fetchJSON, formatString, formatCode, formatPath} from 'run-common';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';

export async function exec(command, args, {directory, commandName, debug} = {}) {
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

export async function execNPM(args, options) {
  const command = require.resolve('npm/bin/npm-cli.js');
  args = [...args, '--no-shrinkwrap'];
  await exec(command, args, {...options, commandName: 'npm'});
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
