import {validateEmailAddress, validateEmailDomain, isDisposableEmail} from './';

(async () => {
  console.log('=== validateEmailAddress ===\n');

  function validateAddress(email) {
    console.log(
      `${JSON.stringify(email)}: ${validateEmailAddress(email, {throwIfInvalid: false})}`
    );
  }

  validateAddress('steve@apple.com');
  validateAddress('info@paris.fr');
  validateAddress('JOHN@DOMAIN.COM');
  validateAddress('john');
  validateAddress('john@');
  validateAddress('domain.com');
  validateAddress('@domain.com');
  validateAddress('john@domain');
  validateAddress('john@domain.com.');
  validateAddress('first last@domain.com');
  validateAddress('john@domain.com ');
  validateAddress(' john@domain.com ');

  console.log('\n=== validateEmailDomain ===\n');

  async function validateDomain(email) {
    const result = await validateEmailDomain(email, {throwIfInvalid: false});
    console.log(`${JSON.stringify(email)}: ${result}`);
  }

  await validateDomain('steve@apple.com');
  await validateDomain('nobody@ynvhunb87cjd.fr');

  console.log('\n=== isDiposable ===\n');

  function isDiposable(email) {
    console.log(`${JSON.stringify(email)}: ${isDisposableEmail(email)}`);
  }

  isDiposable('user@domain.com');
  isDiposable('user@jetable.org');
  isDiposable('user@wildcard.33mail.com');
})();
