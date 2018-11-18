import {formatNumber, formatCode} from '@resdir/console';
import {createClientError} from '@resdir/error';

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

export function validateResourceDescription(
  description,
  {attributeName = '@description', throwIfInvalid = true} = {}
) {
  const {isValid, errorMessage} = validate(description, {attributeName});

  if (isValid || !throwIfInvalid) {
    return isValid;
  }

  throw createClientError(errorMessage);
}

function validate(description, {attributeName}) {
  if (typeof description !== 'string') {
    return {
      isValid: false,
      errorMessage: `${formatCode(attributeName)} attribute must be a string`
    };
  }

  if (description.length < MIN_LENGTH) {
    return {
      isValid: false,
      errorMessage: `${formatCode(
        attributeName
      )} attribute is too short (minimum characters is ${formatNumber(MIN_LENGTH)})`
    };
  }

  if (description.length > MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `${formatCode(
        attributeName
      )} attribute is too long (maximum characters is ${formatNumber(MAX_LENGTH)})`
    };
  }

  return {isValid: true};
}
