import {prompt, formatString, formatMessage} from '../../../dist';

(async () => {
  const email = await prompt('Enter your email address:', {default: 'user@domain.xyz'});
  console.log(`${formatMessage(`Your email address is ${formatString(email)}`, {status: 'success'})}`);
})().catch(err => console.error(err));
