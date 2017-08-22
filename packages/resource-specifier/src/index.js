import {isAbsolute} from 'path';
import {validateResourceName} from '@resdir/resource-name';
import VersionRange from '@resdir/version-range';

export function parseResourceSpecifier(specifier) {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    return {location: specifier};
  }

  let name = specifier;
  let versionRange;

  const index = name.indexOf('@', 1);
  if (index !== -1) {
    versionRange = name.slice(index + 1);
    name = name.slice(0, index);
  }

  validateResourceName(name, {throwIfUnscoped: true});

  versionRange = new VersionRange(versionRange);

  return {name, versionRange};
}

export function validateResourceSpecifier(specifier) {
  parseResourceSpecifier(specifier);
}
