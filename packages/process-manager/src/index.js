import {execFile, spawn} from 'child-process-promise';
import {formatCode, formatPath} from '@resdir/console';

export async function execute(command, args, {directory, commandName, debug} = {}) {
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
