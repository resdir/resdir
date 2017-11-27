import {formatString} from '@resdir/console';

export function validateResourceKey(key, {throwIfInvalid = true} = {}) {
  const isValid = validate(key);

  if (!isValid) {
    if (throwIfInvalid) {
      throw new Error(`Resource key ${formatString(key)} is invalid`);
    }
    return false;
  }

  return true;
}

function validate(key) {
  if (typeof key !== 'string') {
    return false;
  }

  if (key.length === 0) {
    return false;
  }

  if (/[^a-zA-Z0-9_$]/.test(key)) {
    return false;
  }

  if (/[0-9]/.test(key[0])) {
    return false;
  }

  return true;
}
