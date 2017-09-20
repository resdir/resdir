import {formatString} from '@resdir/console';

export function validateNamespace(namespace, {throwIfInvalid = true} = {}) {
  if (!validate(namespace)) {
    if (throwIfInvalid) {
      throw new Error(`Namespace ${formatString(namespace)} is invalid`);
    }
    return false;
  }

  return true;
}

function validate(namespace) {
  if (typeof namespace !== 'string') {
    return false;
  }

  if (namespace.length < 2) {
    return false;
  }

  if (/[^a-z0-9-]/.test(namespace)) {
    return false;
  }

  if (namespace.startsWith('-') || namespace.endsWith('-') || namespace.includes('--')) {
    return false;
  }

  return true;
}
