import {entries} from 'lodash';
import {parse} from 'shell-quote';
import {takeProperty} from '@resdir/util';
import {formatCode, formatNumber} from '@resdir/console';
import {createClientError} from '@resdir/error';

const PARSED_EXPRESSION_TAG = '@@PARSED_EXPRESSION';
const POSITIONAL_ARGUMENT_PREFIX = '@@POSITIONAL_ARGUMENT_';
const SUB_ARGUMENTS_KEY = '@@SUB_ARGUMENTS';

export function parseExpression(expression) {
  if (typeof expression !== 'string') {
    throw new Error('\'expression\' must be a string');
  }

  // TODO: Replace 'shell-quote' with something more suitable

  // // Prevent 'shell-quote' from interpreting operators:
  // for (const operator of '|&;()<>') {
  //   expression = expression.replace(
  //     new RegExp('\\' + operator, 'g'),
  //     '\\' + operator
  //   );
  // }

  expression = parse(expression, _variable => {
    throw new Error('Expression variables are not yet implemented');
  });

  expression = findSubexpressions(expression);

  expression = parseArgumentsAndOptions(expression);

  return expression;
}

function findSubexpressions(expression, {isSubexpression} = {}) {
  if (!Array.isArray(expression)) {
    throw new TypeError('\'expression\' must be an array');
  }

  const result = [];

  while (expression.length) {
    const part = expression.shift();

    if (typeof part === 'string') {
      result.push(part);
      continue;
    }

    const op = part.op;

    if (op === '(') {
      const subexpression = findSubexpressions(expression, {isSubexpression: true});
      result.push(subexpression);
      continue;
    }

    if (op === ')') {
      if (!isSubexpression) {
        throw createClientError(`Unexpected ${formatCode(')')} found while parsing an expression`);
      }
      return result;
    }

    throw createClientError(`Expression parsing failed (part: ${JSON.stringify(part)})`);
  }

  if (isSubexpression) {
    throw createClientError(`Expected ${formatCode(')')} not found while parsing an expression`);
  }

  return result;
}

function parseArgumentsAndOptions(argsAndOpts) {
  if (!Array.isArray(argsAndOpts)) {
    throw new TypeError('\'argsAndOpts\' must be an array');
  }

  let subArgsAndOpts;
  const index = argsAndOpts.indexOf('--');
  if (index !== -1) {
    subArgsAndOpts = argsAndOpts.slice(index + 1);
    argsAndOpts = argsAndOpts.slice(0, index);
  }

  const result = _parseArgumentsAndOptions(argsAndOpts);

  if (subArgsAndOpts) {
    const subResult = _parseArgumentsAndOptions(subArgsAndOpts);
    setSubArguments(result, subResult);
  }

  return result;
}

function _parseArgumentsAndOptions(argsAndOpts) {
  const result = {[PARSED_EXPRESSION_TAG]: true};

  for (let i = 0, position = 0; i < argsAndOpts.length; i++) {
    let argOrOpt = argsAndOpts[i];

    if (Array.isArray(argOrOpt)) {
      argOrOpt = _parseArgumentsAndOptions(argOrOpt);
    }

    if (typeof argOrOpt === 'string' && argOrOpt.startsWith('--')) {
      let opt = argOrOpt.slice(2);
      let val;

      const index = opt.indexOf('=');
      if (index !== -1) {
        val = opt.slice(index + 1);
        opt = opt.slice(0, index);
      }

      if (val === undefined) {
        if (opt.startsWith('no-')) {
          val = 'false';
          opt = opt.slice(3);
        } else if (opt.startsWith('non-')) {
          val = 'false';
          opt = opt.slice(4);
        } else if (opt.startsWith('@no-')) {
          val = 'false';
          opt = '@' + opt.slice(4);
        } else if (opt.startsWith('@non-')) {
          val = 'false';
          opt = '@' + opt.slice(5);
        }
      }

      if (val === undefined && i + 1 < argsAndOpts.length) {
        const nextArgOrOpt = argsAndOpts[i + 1];
        if (typeof nextArgOrOpt !== 'string' || !nextArgOrOpt.startsWith('-')) {
          val = nextArgOrOpt;
          i++;
        }
      }

      if (val === undefined) {
        val = 'true';
      }

      result[opt] = val;
      continue;
    }

    if (typeof argOrOpt === 'string' && argOrOpt.startsWith('-')) {
      const opts = argOrOpt.slice(1);
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i];
        if (!/[\w\d]/.test(opt)) {
          throw createClientError(`Invalid command line option: ${formatCode(argOrOpt)}`);
        }
        result[opt] = 'true';
      }
      continue;
    }

    result[makePositionalArgumentKey(position)] = argOrOpt;
    position++;
  }

  return result;
}

// schema:
// [
//   {key: 'files', aliases: ['f'], position: 0, isVariadic: true, isSubArguments: true}
// ]
export function matchExpression(expression, schema = []) {
  const result = {};
  const remainder = {};

  for (const [key, value] of entries(expression)) {
    if (key === PARSED_EXPRESSION_TAG) {
      continue;
    }

    const matchedKey = _matchArgument(key, schema);

    if (matchedKey === undefined) {
      remainder[key] = value;
      continue;
    }

    const previousValue = result[matchedKey];
    if (previousValue !== undefined) {
      if (Array.isArray(previousValue)) {
        previousValue.push(value);
      } else {
        result[matchedKey] = [previousValue, value];
      }
    } else {
      result[matchedKey] = value;
    }
  }

  return {result, remainder};
}

function _matchArgument(key, schema) {
  if (isPositionalArgumentKey(key)) {
    return _matchPosisionalArgument(key, schema);
  }

  if (isSubArgumentsKey(key)) {
    return _matchSubArguments(schema);
  }

  return _matchNamedArgument(key, schema);
}

function _matchPosisionalArgument(key, schema) {
  const position = parsePositionalArgumentKey(key);
  for (const argument of schema) {
    if (argument.position === undefined) {
      continue;
    }
    if (argument.position === position) {
      return argument.key;
    }
    if (argument.isVariadic && argument.position < position) {
      return argument.key;
    }
  }
  throw createClientError(`Cannot match positional argument (position: ${formatNumber(position)})`);
}

function _matchSubArguments(schema) {
  for (const argument of schema) {
    if (argument.isSubArguments) {
      return argument.key;
    }
  }
  throw createClientError(`Cannot match sub-arguments`);
}

function _matchNamedArgument(key, schema) {
  for (const argument of schema) {
    if (argument.key === key) {
      return argument.key;
    }
    if (argument.aliases && argument.aliases.includes(key)) {
      return argument.key;
    }
  }
}

export function isParsedExpression(expression) {
  return (
    typeof expression === 'object' &&
    Object.prototype.hasOwnProperty.call(expression, PARSED_EXPRESSION_TAG)
  );
}

export function takeArgument(expression, key, aliases) {
  return takeProperty(expression, key, aliases);
}

export function getPositionalArgument(expression, position) {
  return expression[makePositionalArgumentKey(position)];
}

export function shiftPositionalArguments(args) {
  let firstArgument;
  let key;
  let previousKey;
  let position = 0;
  while (true) {
    previousKey = key;
    key = makePositionalArgumentKey(position);
    if (!(key in args)) {
      break;
    }
    if (position === 0) {
      firstArgument = args[key];
    } else {
      args[previousKey] = args[key];
    }
    delete args[key];
    position++;
  }
  return firstArgument;
}

export function findPositionalArguments(args) {
  const positionalArguments = [];
  let position = 0;
  while (true) {
    const key = makePositionalArgumentKey(position);
    if (!(key in args)) {
      break;
    }
    positionalArguments.push(args[key]);
    position++;
  }
  return positionalArguments;
}

export function makePositionalArgumentKey(position) {
  return POSITIONAL_ARGUMENT_PREFIX + String(position);
}

export function parsePositionalArgumentKey(key) {
  if (!isPositionalArgumentKey(key)) {
    throw new Error(`${formatCode(key)} is not a positional argument key`);
  }
  return Number(key.slice(POSITIONAL_ARGUMENT_PREFIX.length));
}

export function isPositionalArgumentKey(key) {
  return key.startsWith(POSITIONAL_ARGUMENT_PREFIX);
}

export function getSubArguments(args) {
  return args[SUB_ARGUMENTS_KEY];
}

export function setSubArguments(args, subArgs) {
  args[SUB_ARGUMENTS_KEY] = subArgs;
}

export function getSubArgumentsKey() {
  return SUB_ARGUMENTS_KEY;
}

export function isSubArgumentsKey(key) {
  return key === SUB_ARGUMENTS_KEY;
}
