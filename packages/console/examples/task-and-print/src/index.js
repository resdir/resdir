import sleep from 'sleep-promise';
import {task, print} from '../../../dist';

const environment = {
  '@verbose': process.argv.includes('--@verbose')
};

(async () => {
  await task(
    async () => {
      await sleep(1000);
      await task(
        async () => {
          await sleep(1000);
          print('120 files loaded');
          await sleep(2000);
          print('WARNING: README is missing');
          await sleep(2000);
        },
        {intro: 'Configuring...', outro: 'Configured'}
      );
    },
    {intro: 'Creating package...', outro: 'Package created'},
    environment
  );
})().catch(err => console.error(err));
