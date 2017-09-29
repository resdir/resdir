import regexEmail from 'regex-email';
import validateEmailHostname from 'validate-email-hostname';
const disposableDomains = require('disposable-email-domains');
const disposableWildcardDomains = require('disposable-email-domains/wildcard.json');
import {formatString} from '@resdir/console';

export function validateEmailAddress(email, {throwIfInvalid = true} = {}) {
  if (!email) {
    if (throwIfInvalid) {
      throw new Error('Email address is missing');
    }
    return false;
  }

  if (!regexEmail.test(email)) {
    if (throwIfInvalid) {
      throw new Error(`Email address is invalid (${formatString(email)})`);
    }
    return false;
  }

  return true;
}

export async function validateEmailDomain(email, {throwIfInvalid = true} = {}) {
  if (!validateEmailAddress(email, {throwIfInvalid})) {
    return false;
  }

  if (!await validateEmailHostname(email)) {
    if (throwIfInvalid) {
      throw new Error(`Email domain is invalid (${formatString(email)})`);
    }
    return false;
  }

  return true;
}

export function isDisposableEmail(email) {
  validateEmailAddress(email);

  const domain = email.split('@')[1].toLowerCase();

  if (disposableDomains.includes(domain)) {
    return true;
  }

  for (const wildcard of disposableWildcardDomains) {
    if (domain.endsWith('.' + wildcard)) {
      return true;
    }
  }

  return false;
}
