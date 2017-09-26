import sleep from 'sleep-promise';
import {task} from '../../../dist';

(async () => {
  await task(
    async () => {
      await sleep(1000);
      await task(
        async () => {
          await sleep(1000);
          await task(
            async () => {
              await sleep(1000);
            },
            {intro: 'Transpiling resource...', outro: 'Resource transpiled'}
          );
          await sleep(1000);
        },
        {intro: 'Building resource...', outro: 'Resource built'}
      );
      await task(
        async () => {
          await sleep(1000);
        },
        {intro: 'Testing resource...', outro: 'Resource tested'}
      );
      await sleep(1000);
    },
    {intro: 'Publishing resource...', outro: 'Resource published'}
  );
})().catch(err => console.error(err));