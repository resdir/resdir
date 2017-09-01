import {prompt, formatString} from '../../../dist';

(async () => {
  const email = await prompt('Enter your email address:', {default: 'user@domain.xyz'});
  console.log(`Your email address is ${formatString(email)}`);
})().catch(err => console.error(err));
