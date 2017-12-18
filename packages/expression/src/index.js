import {parse} from 'shell-quote';
import {takeProperty} from '@resdir/util';
import {formatCode} from '@resdir/console';

const PARSED_EXPRESSION_TAG = '@@PARSED_EXPRESSION';
const POSITIONAL_ARGUMENT_PREFIX = '@@POSITIONAL_ARGUMENT_';
const SUB_ARGUMENTS_KEY = '@@SUB_ARGUMENTS';

export function parseExpression(expression) {
  if (typeof expression !== 'string') {
    throw new TypeError('\'expression\' must be a string');
  }

  // TODO: Replace 'shell-quote' with something more suitable

  // // Prevent 'shell-quote' from interpreting operators:
  // for (const operator of '|&;()<>') {
  //   expression = expression.replace(
  //     new RegExp('\\' + operator, 'g'),
  //     '\\' + operator
  //   );
  // }

  let parsedExpression = parse(expression, _variable => {
    throw new Error('Expression variables are not yet implemented');
  });

  parsedExpression = parsedExpression.map(arg => {
    if (typeof arg === 'string') {
      return arg;
    }
    throw new Error(`Expression parsing failed (arg: ${JSON.stringify(arg)})`);
  });

  parsedExpression = parseArgumentsAndOptions(parsedExpression);

  return parsedExpression;
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
    const argOrOpt = argsAndOpts[i];

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
          throw new Error(`Invalid command line option: ${formatCode(argOrOpt)}`);
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

export function handleParsedExpression(expression) {
  const isParsedExpression = PARSED_EXPRESSION_TAG in expression;
  if (isParsedExpression) {
    delete expression[PARSED_EXPRESSION_TAG];
  }
  return isParsedExpression;
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

export function getSubArguments(args) {
  return args[SUB_ARGUMENTS_KEY];
}

export function setSubArguments(args, subArgs) {
  args[SUB_ARGUMENTS_KEY] = subArgs;
}

export function getSubArgumentsKey() {
  return SUB_ARGUMENTS_KEY;
}
