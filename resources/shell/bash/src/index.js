import {execSync} from 'child_process';

const SHELL = '/bin/bash';

export default () => ({
  run({command}) {
    execSync(command, {stdio: 'inherit', shell: SHELL});
  }
});
