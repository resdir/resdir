import {validateNamespace as importedValidateNamespace} from '@resdir/namespace';
import {formatString} from '@resdir/console';

export function parseResourceName(name, {throwIfMissing = true} = {}) {
  const parsedName = parse(name);
  if (!parsedName) {
    if (throwIfMissing) {
      throw new Error(`Resource name is missing`);
    }
    return undefined;
  }
  if (!parsedName.namespace) {
    throw new Error(`Namespace is missing in resource name '${formatString(name)}'`);
  }
  return parsedName;
}

export function getResourceNamespace(name) {
  const parsedName = parse(name);
  return parsedName && parsedName.namespace;
}

export function getResourceIdentifier(name) {
  const parsedName = parse(name);
  return parsedName && parsedName.identifier;
}

export function validateResourceName(name, {throwIfInvalid = true} = {}) {
  const isValid = validate(name);

  if (!isValid) {
    if (throwIfInvalid) {
      throw new Error(`Resource name ${formatString(name)} is invalid`);
    }
    return false;
  }

  return true;
}

function parse(name) {
  if (typeof name !== 'string') {
    return undefined;
  }
  let [namespace, identifier, rest] = name.split('/');
  if (rest !== undefined) {
    return undefined;
  }
  if (identifier === undefined) {
    identifier = namespace;
    namespace = undefined;
  }
  if (identifier === '' || namespace === '') {
    return undefined;
  }
  return {namespace, identifier};
}

function validate(name) {
  const parsedName = parse(name);

  if (!parsedName) {
    return false;
  }

  const {namespace, identifier} = parsedName;

  if (!validateNamespace(namespace)) {
    return false;
  }

  if (!validateIdentifier(identifier)) {
    return false;
  }

  return true;
}

export function validateNamespace(...args) {
  return importedValidateNamespace(...args);
}

function validateIdentifier(identifier) {
  if (typeof identifier !== 'string') {
    return false;
  }

  if (identifier.length < 1) {
    return false;
  }

  if (/[^a-z0-9-]/.test(identifier)) {
    return false;
  }

  if (identifier.startsWith('-') || identifier.endsWith('-') || identifier.includes('--')) {
    return false;
  }

  return true;
}
