export function getScope(name) {
  if (!name) {
    return undefined;
  }
  const [scope, identifier] = name.split('/');
  if (!identifier) {
    return undefined;
  }
  return scope;
}

export function getIdentifier(name) {
  if (!name) {
    return undefined;
  }
  const [scope, identifier] = name.split('/');
  if (!identifier) {
    return scope;
  }
  return identifier;
}

export function validate(name) {
  let [scope, identifier, rest] = name.split('/');

  if (scope && identifier === undefined) {
    identifier = scope;
    scope = undefined;
  }

  if (scope !== undefined && !validatePart(scope)) {
    return false;
  }

  if (!validatePart(identifier)) {
    return false;
  }

  if (rest) {
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
