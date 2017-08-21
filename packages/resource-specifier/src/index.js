import {isAbsolute} from 'path';
import {validate as validateName} from '@resdir/resource-name';
import VersionRange from '@resdir/version-range';

export function parse(specifier) {
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

  validateName(name, {throwIfUnscoped: true});

  versionRange = new VersionRange(versionRange);

  return {name, versionRange};
}

export function validate(specifier) {
  parse(specifier);
}
