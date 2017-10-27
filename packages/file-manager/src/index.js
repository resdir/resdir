import {extname} from 'path';
import {readFileSync, writeFileSync} from 'fs';
import JSON5 from 'json5';
import YAML from 'js-yaml';
import {formatPath} from '@resdir/console';

export function load(file, {throwIfNotFound = true, parse = true} = {}) {
  if (typeof file !== 'string') {
    throw new TypeError('\'file\' must be a string');
  }

  let data;

  try {
    data = readFileSync(file, 'utf8');
  } catch (_) {
    if (throwIfNotFound) {
      throw new Error(`File not found: ${formatPath(file)}`);
    }
    return undefined;
  }

  if (parse) {
    let parser;
    const ext = extname(file);
    if (ext === '.json') {
      parser = data => JSON.parse(data);
    } else if (ext === '.json5') {
      parser = data => JSON5.parse(data);
    } else if (ext === '.yaml' || ext === '.yml') {
      parser = data => YAML.safeLoad(data);
    } else {
      throw new Error(`Unsupported file format: ${formatPath(file)}`);
    }

    try {
      data = parser(data);
    } catch (err) {
      throw new Error(`Invalid file: ${formatPath(file)} (${err.message})`);
    }
  }

  return data;
}

export function save(file, data, {stringify = true} = {}) {
  if (typeof file !== 'string') {
    throw new TypeError('\'file\' must be a string');
  }

  if (stringify) {
    const ext = extname(file);
    if (ext === '.json') {
      data = JSON.stringify(data, undefined, 2);
    } else if (ext === '.json5') {
      data = JSON5.stringify(data, undefined, 2);
    } else if (ext === '.yaml' || ext === '.yml') {
      data = YAML.safeDump(data);
    } else {
      throw new Error(`Unsupported file format: ${formatPath(file)}`);
    }

    if (!data.endsWith('\n')) {
      data += '\n';
    }
  }

  writeFileSync(file, data);
}
