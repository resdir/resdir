import crypto from 'crypto';
import {entries, cloneDeepWith} from 'lodash';
import {formatCode} from '@resdir/console';

export function getProperty(source, name, aliases) {
  const result = getPropertyKeyAndValue(source, name, aliases);
  return result && result.value;
}

export function setProperty(target, source, name, aliases) {
  const result = getPropertyKeyAndValue(source, name, aliases);
  if (result) {
    target[name] = result.value;
  }
}

export function takeProperty(source, name, aliases) {
  const result = getPropertyKeyAndValue(source, name, aliases);
  if (result) {
    delete source[result.key];
    return result.value;
  }
}

export function getPropertyKeyAndValue(source, name, aliases = []) {
  if (source === undefined) {
    return;
  }
  let result;
  const keys = [name, ...aliases];
  let foundKey;
  for (const key of keys) {
    if (key && key in source) {
      if (foundKey) {
        throw new Error(`Can't have both ${formatCode(foundKey)} and ${formatCode(key)}`);
      }
      result = {key, value: source[key]};
      foundKey = key;
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
      throw new Error(
        `Wrong property name: ${formatCode(wrong)}. Did you mean ${formatCode(correct)}?`
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
