import {validateNamespace as importedValidateNamespace} from '@resdir/namespace';
import {formatString} from '@resdir/console';
import {createClientError} from '@resdir/error';
import {windowsNames as reservedWindowsFilenames} from 'filename-reserved-regex';

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 80;

export function parseResourceIdentifier(identifier, {throwIfMissing = true} = {}) {
  const parsedIdentifier = parse(identifier);
  if (!parsedIdentifier) {
    if (throwIfMissing) {
      throw createClientError(`Resource identifier is missing`);
    }
    return undefined;
  }
  if (!parsedIdentifier.namespace) {
    throw createClientError(
      `Namespace is missing in resource identifier '${formatString(identifier)}'`
    );
  }
  return parsedIdentifier;
}

export function getResourceNamespace(identifier) {
  const parsedIdentifier = parse(identifier);
  return parsedIdentifier && parsedIdentifier.namespace;
}

export function getResourceName(identifier) {
  const parsedIdentifier = parse(identifier);
  return parsedIdentifier && parsedIdentifier.name;
}

export function validateResourceIdentifier(identifier, {throwIfInvalid = true} = {}) {
  const isValid = validate(identifier);

  if (!isValid) {
    if (throwIfInvalid) {
      if (identifier) {
        throw createClientError(`Resource identifier ${formatString(identifier)} is invalid`);
      } else {
        throw createClientError(`Resource identifier is missing`);
      }
    }
    return false;
  }

  return true;
}

function parse(identifier) {
  if (typeof identifier !== 'string') {
    return undefined;
  }
  let [namespace, name, rest] = identifier.split('/');
  if (rest !== undefined) {
    return undefined;
  }
  if (name === undefined) {
    name = namespace;
    namespace = undefined;
  }
  if (name === '' || namespace === '') {
    return undefined;
  }
  return {namespace, name};
}

function validate(identifier) {
  const parsedIdentifier = parse(identifier);

  if (!parsedIdentifier) {
    return false;
  }

  const {namespace, name} = parsedIdentifier;

  if (!validateNamespace(namespace, {throwIfInvalid: false})) {
    return false;
  }

  if (!validateName(name)) {
    return false;
  }

  return true;
}

export function validateNamespace(...args) {
  return importedValidateNamespace(...args);
}

function validateName(name) {
  if (typeof name !== 'string') {
    return false;
  }

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return false;
  }

  if (/[^a-z0-9-]/.test(name)) {
    return false;
  }

  if (name.startsWith('-') || name.endsWith('-') || name.includes('--')) {
    return false;
  }

  return true;
}

export function isReservedWindowsFilename(name) {
  return reservedWindowsFilenames().test(name);
}
