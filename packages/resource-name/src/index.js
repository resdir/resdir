import {formatNumber, formatCode} from '@resdir/console';
import {createClientError} from '@resdir/error';

const MIN_LENGTH = 2;
const MAX_LENGTH = 50;

export function validateResourceName(name, {attributeName = '@name', throwIfInvalid = true} = {}) {
  const {isValid, errorMessage} = validate(name, {attributeName});

  if (isValid || !throwIfInvalid) {
    return isValid;
  }

  throw createClientError(errorMessage);
}

function validate(name, {attributeName}) {
  if (typeof name !== 'string') {
    return {
      isValid: false,
      errorMessage: `${formatCode(attributeName)} attribute must be a string`
    };
  }

  if (name.length < MIN_LENGTH) {
    return {
      isValid: false,
      errorMessage: `${formatCode(
        attributeName
      )} attribute is too short (minimum characters is ${formatNumber(MIN_LENGTH)})`
    };
  }

  if (name.length > MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `${formatCode(
        attributeName
      )} attribute is too long (maximum characters is ${formatNumber(MAX_LENGTH)})`
    };
  }

  return {isValid: true};
}
