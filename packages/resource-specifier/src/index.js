import {isAbsolute} from 'path';
import {validateResourceIdentifier} from '@resdir/resource-identifier';
import VersionRange from '@resdir/version-range';

export function parseResourceSpecifier(specifier) {
  if (specifier === undefined) {
    throw new Error('\'specifier\' argument is missing');
  }

  if (typeof specifier !== 'string') {
    throw new Error('\'specifier\' argument must be a string');
  }

  if (specifier.startsWith('.') || isAbsolute(specifier) || specifier.match(/^https?:\/\//i)) {
    return {location: specifier};
  }

  let identifier = specifier;
  let versionRange;

  const index = identifier.indexOf('#', 1);
  if (index !== -1) {
    versionRange = identifier.slice(index + 1);
    identifier = identifier.slice(0, index);
  }

  validateResourceIdentifier(identifier);

  versionRange = new VersionRange(versionRange);

  return {identifier, versionRange};
}

export function validateResourceSpecifier(specifier) {
  parseResourceSpecifier(specifier);
}

export function stringifyResourceSpecifier({identifier, versionRange, location}) {
  if (location) {
    return location;
  }

  if (!identifier) {
    throw new Error('\'identifier\' argument is missing');
  }

  let specifier = identifier;
  if (versionRange) {
    specifier += '#' + String(versionRange);
  }

  return specifier;
}

export function isResourceSpecifier(string) {
  return string.startsWith('.') || string.includes('/') || isAbsolute(string);
}
