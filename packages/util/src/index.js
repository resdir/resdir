import crypto from 'crypto';
import {entries, cloneDeepWith} from 'lodash';
import {formatCode} from '@resdir/console';
import {createClientError} from '@resdir/error';

export function getProperty(source, key, aliases) {
  const result = findProperty(source, key, aliases);
  return result && result.value;
}

export function setProperty(target, source, key, aliases) {
  const result = findProperty(source, key, aliases);
  if (result) {
    target[key] = result.value;
  }
}

export function takeProperty(source, key, aliases) {
  const result = findProperty(source, key, aliases);
  if (result) {
    delete source[result.foundKey];
    return result.value;
  }
}

export function findProperty(source, key, aliases = []) {
  if (source === undefined) {
    return;
  }
  let result;
  let foundKey;
  for (const keyOrAlias of [key, ...aliases]) {
    if (keyOrAlias && keyOrAlias in source) {
      if (foundKey) {
        throw createClientError(
          `Can't have both ${formatCode(foundKey)} and ${formatCode(keyOrAlias)}`
        );
      }
      foundKey = keyOrAlias;
      result = {foundKey, value: source[keyOrAlias]};
    }
  }
  return result;
}

export function generateHash(data, algorithm = 'sha256') {
  const hash = crypto.createHash(algorithm);
  hash.update(data);
  return hash.digest('hex');
}

export async function catchError(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
}

export function avoidCommonMistakes(obj, mistakes) {
  for (const [wrong, correct] of entries(mistakes)) {
    if (wrong in obj) {
      throw createClientError(
        `Wrong property key: ${formatCode(wrong)}. Did you mean ${formatCode(correct)}?`
      );
    }
  }
}

export function callSuper(method, context, ...args) {
  const methodName = method.name;
  let proto = context;
  while (true) {
    const superProto = Object.getPrototypeOf(proto);
    if (superProto === null) {
      throw new Error(`Super method '${methodName}' not found`);
    }
    if (Object.prototype.hasOwnProperty.call(proto, methodName) && proto[methodName] === method) {
      const superMethod = superProto[methodName];
      return superMethod.apply(context, args);
    }
    proto = superProto;
  }
}

export function compactObject(obj) {
  const result = {};
  for (const [key, value] of entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export function cloneDeepWithMethod(obj, method) {
  return cloneDeepWith(obj, value => {
    if (typeof value === 'object' && value !== null && method in value) {
      value = value.toJSON();
      value = cloneDeepWithMethod(value, method);
      return value;
    }
  });
}

export function toJSONDeep(obj) {
  return cloneDeepWithMethod(obj, 'toJSON');
}
