import {formatString, formatNumber, formatValue} from '@resdir/console';
import {createClientError} from '@resdir/error';

const MAX_KEYWORDS = 8;
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 24;

export default () => ({
  async validate({throwIfInvalid}) {
    if (!this.$value) {
      return true;
    }

    const {isValid, error} = validateKeywords(this.$value);

    if (!isValid) {
      if (throwIfInvalid) {
        throw createClientError(error);
      }
      return false;
    }

    return true;
  }
});

function validateKeywords(keywords) {
  if (keywords.length > MAX_KEYWORDS) {
    return {
      isValid: false,
      error: `Sorry, the maximum number of allowed keywords is ${formatNumber(MAX_KEYWORDS)}`
    };
  }

  for (const keyword of keywords) {
    const result = validateKeyword(keyword);
    if (!result.isValid) {
      return result;
    }
  }

  return {isValid: true};
}

function validateKeyword(keyword) {
  if (typeof keyword !== 'string') {
    return {
      isValid: false,
      error: `The keyword ${formatValue(keyword)} is invalid (it should be a string)`
    };
  }

  if (keyword.length < MIN_KEYWORD_LENGTH) {
    return {
      isValid: false,
      error: `The keyword ${formatString(keyword)} is too short (minimum characters is ${formatNumber(MIN_KEYWORD_LENGTH)})`
    };
  }

  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return {
      isValid: false,
      error: `The keyword ${formatString(keyword)} is too long (maximum characters is ${formatNumber(MAX_KEYWORD_LENGTH)})`
    };
  }

  if (/[^a-z0-9-]/.test(keyword)) {
    return {
      isValid: false,
      error: `The keyword ${formatString(keyword)} is invalid (only lowercase letters, numbers and dashes are allowed)`
    };
  }

  if (keyword.startsWith('-') || keyword.endsWith('-')) {
    return {
      isValid: false,
      error: `The keyword ${formatString(keyword)} is invalid (cannot start or end with a dash)`
    };
  }

  if (keyword.includes('--')) {
    return {
      isValid: false,
      error: `The keyword ${formatString(keyword)} is invalid (cannot include two successive dashes)`
    };
  }

  return {isValid: true};
}
