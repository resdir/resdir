import sleep from 'sleep-promise';
import {task, prompt} from '../../../dist';

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
          await prompt('Package name:');
          await sleep(2000);
          await prompt('Version number:', {default: '0.1.0'});
          await sleep(2000);
        },
        {intro: 'Configuring...', outro: 'Configured'}
      );
    },
    {intro: 'Creating package...', outro: 'Package created'},
    environment
  );
})().catch(err => console.error(err));
