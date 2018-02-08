import sortedIndexOf from 'lodash.sortedindexof';
import {formatString} from '@resdir/console';
import {createClientError} from '@resdir/error';
import genericNamespaces from './generic-namespaces.json';
import reservedNamespaces from './reserved-namespaces.json';
import {windowsNames as reservedWindowsFilenames} from 'filename-reserved-regex';

const MIN_LENGTH = 1;
const MAX_LENGTH = 40;

export function validateNamespace(namespace, {throwIfInvalid = true} = {}) {
  if (!validate(namespace)) {
    if (throwIfInvalid) {
      throw createClientError(`Namespace ${formatString(namespace)} is invalid`);
    }
    return false;
  }

  return true;
}

function validate(namespace) {
  if (typeof namespace !== 'string') {
    return false;
  }

  if (namespace.length < MIN_LENGTH || namespace.length > MAX_LENGTH) {
    return false;
  }

  if (/[^a-z0-9-]/.test(namespace)) {
    return false;
  }

  if (namespace.startsWith('-') || namespace.endsWith('-') || namespace.includes('--')) {
    return false;
  }

  return true;
}

export function isGenericNamespace(namespace) {
  return sortedIndexOf(genericNamespaces, namespace) !== -1;
}

export function isReservedNamespace(namespace) {
  return reservedNamespaces.includes(namespace);
}

export function isReservedWindowsFilename(namespace) {
  return reservedWindowsFilenames().test(namespace);
}
