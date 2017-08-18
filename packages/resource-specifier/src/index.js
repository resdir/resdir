import {isAbsolute} from 'path';
import {validate as validateName} from '@resdir/resource-name';
import VersionRange from '@resdir/version-range';
import {formatString} from '@resdir/console';

export function parse(specifier) {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    return {location: specifier};
  }

  let name = specifier;
  let version;

  const index = name.indexOf('@', 1);
  if (index !== -1) {
    version = name.slice(index + 1);
    name = name.slice(0, index);
  }

  if (!validateName(name)) {
    throw new Error(`Resource name ${formatString(name)} is invalid`);
  }

  version = new VersionRange(version);

  return {name, version};
}
