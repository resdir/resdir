import notifier from 'node-notifier';

export default base =>
  class extends base {
    notify({title, message, icon}) {
      notifier.notify({title, message, icon});
    }
  };
