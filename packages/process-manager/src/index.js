import childProcessPromise from 'child-process-promise';
const {execFile, spawn} = childProcessPromise;
import {formatCode, formatPath} from '@resdir/console';
import {createClientError} from '@resdir/error';

export async function execute(command, args, {directory, commandName} = {}, environment) {
  try {
    if (environment && environment['@debug']) {
      await spawn(command, args, {cwd: directory, stdio: 'inherit'});
    } else {
      await execFile(command, args, {cwd: directory});
    }
  } catch (err) {
    throw createClientError(
      `An error occured while executing ${
        commandName ? formatCode(commandName) : formatPath(command)
      }`,
      {capturedStandardError: err.stderr}
    );
  }
}
