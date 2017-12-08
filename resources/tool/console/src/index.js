import {print} from '@resdir/console';

export default base =>
  class extends base {
    print({message}) {
      print(message || '');
    }
  };
