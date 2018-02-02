import {print} from '@resdir/console';

export default () => ({
  print({message}, environment) {
    print(message || '', environment);
  }
});
