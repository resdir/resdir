import {formatString} from '@resdir/console';

export function parse(name, {throwIfMissing = true, throwIfUnscoped} = {}) {
  const parsedName = _parse(name);
  if (!parsedName) {
    if (throwIfMissing || throwIfUnscoped) {
      throw new Error(`Resource name is missing`);
    }
    return undefined;
  }
  if (!parsedName.scope && throwIfUnscoped) {
    throw new Error(`Scope is missing in resource name '${formatString(name)}'`);
  }
  return parsedName;
}

function _parse(name) {
  if (typeof name !== 'string') {
    return undefined;
  }
  let [scope, identifier, rest] = name.split('/');
  if (rest !== undefined) {
    return undefined;
  }
  if (identifier === undefined) {
    identifier = scope;
    scope = undefined;
  }
  if (identifier === '' || scope === '') {
    return undefined;
  }
  return {scope, identifier};
}

export function getScope(name) {
  const parsedName = _parse(name);
  return parsedName && parsedName.scope;
}

export function getIdentifier(name) {
  const parsedName = _parse(name);
  return parsedName && parsedName.identifier;
}

export function validate(name, {throwIfInvalid = true, throwIfUnscoped} = {}) {
  const isValid = _validate(name);

  if (!isValid) {
    if (throwIfInvalid) {
      throw new Error(`Resource name ${formatString(name)} is invalid`);
    }
    return false;
  }

  if (throwIfUnscoped && !getScope(name)) {
    throw new Error(`Scope is missing in resource name '${formatString(name)}'`);
  }

  return true;
}

function _validate(name) {
  const parsedName = _parse(name);

  if (!parsedName) {
    return false;
  }

  const {scope, identifier} = parsedName;

  if (!validatePart(identifier)) {
    return false;
  }

  if (scope && !validatePart(scope)) {
    return false;
  }

  return true;
}

function validatePart(part) {
  if (!part) {
    return false;
  }

  if (/[^a-z0-9_]/i.test(part[0])) {
    return false;
  }

  if (/[^a-z0-9._-]/i.test(part.slice(1, -1))) {
    return false;
  }

  if (/[^a-z0-9]/i.test(part.slice(-1))) {
    return false;
  }

  return true;
}
