import {execSync} from 'child_process';
import {createClientError} from '@resdir/error';

const SHELL = '/bin/bash';

export default () => ({
  run({command}) {
    try {
      execSync(command, {stdio: 'inherit', shell: SHELL});
    } catch (err) {
      throw createClientError(err.message);
    }
  }
});
