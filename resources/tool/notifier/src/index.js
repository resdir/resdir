import notifier from 'node-notifier';

export default () => ({
  notify({title, message, icon}) {
    notifier.notify({title, message, icon});
  }
});
