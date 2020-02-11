import {run} from 'npm-linker';

export default () => ({
  run() {
    const directory = this.$getCurrentDirectory();

    run(directory);
  }
});
