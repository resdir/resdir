import {formatString} from '@resdir/console';

export function parseResourceName(name, {throwIfMissing = true} = {}) {
  const parsedName = _parse(name);
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

function _parse(name) {
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

export function getResourceNamespace(name) {
  const parsedName = _parse(name);
  return parsedName && parsedName.namespace;
}

export function getResourceIdentifier(name) {
  const parsedName = _parse(name);
  return parsedName && parsedName.identifier;
}

export function validateResourceName(name, {throwIfInvalid = true} = {}) {
  const isValid = _validate(name);

  if (!isValid) {
    if (throwIfInvalid) {
      throw new Error(`Resource name ${formatString(name)} is invalid`);
    }
    return false;
  }

  return true;
}

function _validate(name) {
  const parsedName = _parse(name);

  if (!parsedName) {
    return false;
  }

  const {namespace, identifier} = parsedName;

  if (!validatePart(namespace)) {
    return false;
  }

  if (!validatePart(identifier)) {
    return false;
  }

  return true;
}

function validatePart(part) {
  if (!part) {
    return false;
  }

  if (/[^a-z0-9-]/.test(part)) {
    return false;
  }

  if (part.startsWith('-') || part.endsWith('-') || part.includes('--')) {
    return false;
  }

  return true;
}
