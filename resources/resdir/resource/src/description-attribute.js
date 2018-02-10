import {formatNumber} from '@resdir/console';
import {createClientError} from '@resdir/error';

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

export default () => ({
  async validate({throwIfInvalid}) {
    if (this.$value === undefined) {
      return true;
    }

    const {isValid, error} = validateDescription(this.$value);

    if (!isValid) {
      if (throwIfInvalid) {
        throw createClientError(error);
      }
      return false;
    }

    return true;
  }
});

function validateDescription(description) {
  if (description.length < MIN_LENGTH) {
    return {
      isValid: false,
      error: `The description is too short (minimum characters is ${formatNumber(MIN_LENGTH)})`
    };
  }

  if (description.length > MAX_LENGTH) {
    return {
      isValid: false,
      error: `The description is too long (maximum characters is ${formatNumber(MAX_LENGTH)})`
    };
  }

  return {isValid: true};
}
