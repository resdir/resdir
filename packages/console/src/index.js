import {gray, cyan, yellow} from 'chalk';
import ora from 'ora';
import cliSpinners from 'cli-spinners';
import windowSize from 'window-size';
import sliceANSI from 'slice-ansi';

export function formatString(string) {
  if (typeof string !== 'string') {
    throw new TypeError('\'string\' must be a string');
  }

  return yellow('\'' + string + '\'');
}

export function formatURL(url) {
  if (typeof url !== 'string') {
    throw new TypeError('\'url\' must be a string');
  }

  return cyan.underline(url);
}

export function formatPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('\'path\' must be a string');
  }

  return yellow('\'' + path + '\'');
}

export function formatCode(code) {
  if (typeof code !== 'string') {
    throw new TypeError('\'code\' must be a string');
  }

  return cyan('`' + code + '`');
}

export function formatMessage(message, {info, status} = {}) {
  if (typeof message !== 'string') {
    throw new TypeError('\'message\' must be a string');
  }

  if (info) {
    info = ` ${gray(`(${info})`)}`;
  } else {
    info = '';
  }

  if (status === 'success') {
    status = getSuccessSymbol() + '  ';
  } else if (status === 'error') {
    status = getErrorSymbol() + '  ';
  } else if (status === 'info') {
    status = 'ℹ️️  ';
  } else if (status === 'deployed') {
    status = '🚀  ';
  } else if (status === undefined) {
    status = '';
  } else {
    throw new Error('Invalid status: ' + status);
  }

  return `${status}${message}${info}`;
}

export async function task(fn, {intro, outro, debug, verbose, quiet}) {
  if (typeof fn !== 'function') {
    throw new TypeError('\'fn\' must be a function');
  }

  try {
    if (global.resdirConsoleTaskCount === undefined) {
      global.resdirConsoleTaskCount = 0;
    }

    global.resdirConsoleTaskCount++;

    let progress;

    if (quiet || global.resdirConsoleTaskCount > 1) {
      progress = {
        start() {
          return this;
        },
        complete() {
          return this;
        },
        fail() {
          return this;
        },
        setMessage(_message) {
          return this;
        },
        setOutro(_message) {
          return this;
        }
      };
    } else if (debug || verbose) {
      progress = {
        outro,
        start() {
          return this;
        },
        complete() {
          console.log(getSuccessSymbol() + '  ' + this.outro);
          return this;
        },
        fail() {
          return this;
        },
        setMessage(message) {
          console.log(getRunningSymbol() + '  ' + message);
          return this;
        },
        setOutro(message) {
          this.outro = message;
          return this;
        }
      };
    } else {
      progress = {
        spinner: ora({
          spinner: cliSpinners.runner
        }),
        outro,
        start() {
          this.spinner.start();
          return this;
        },
        complete() {
          this.spinner.stopAndPersist({
            text: this.outro,
            symbol: getSuccessSymbol() + ' '
          });
          return this;
        },
        fail() {
          this.spinner.stopAndPersist({
            symbol: getErrorSymbol() + ' '
          });
          return this;
        },
        setMessage(message) {
          this.spinner.text = adjustToWindowWidth(message, {leftMargin: 3});
          return this;
        },
        setOutro(message) {
          this.outro = message;
          return this;
        }
      };
    }

    progress.setMessage(intro).start();

    try {
      const result = await fn(progress);
      progress.complete();
      return result;
    } catch (err) {
      progress.fail();
      throw err;
    }
  } finally {
    global.resdirConsoleTaskCount--;
  }
}

export function addContextToErrors(targetOrFn, _key, descriptor) {
  if (typeof targetOrFn === 'function') {
    // A function is passed
    return _addContextToErrors(targetOrFn);
  }

  // Decorator
  const oldFn = descriptor.value;
  const newFn = _addContextToErrors(oldFn);
  Object.defineProperty(newFn, 'name', {value: oldFn.name, configurable: true});
  descriptor.value = newFn;
  return descriptor;
}

function _addContextToErrors(fn) {
  return function (...args) {
    const rethrow = err => {
      if (!err.contextStack) {
        err.contextStack = [];
      }
      err.contextStack.push(this);
      throw err;
    };

    try {
      let result = fn.apply(this, args);
      if (result && typeof result.then === 'function') {
        result = result.catch(rethrow);
      }
      return result;
    } catch (err) {
      rethrow(err);
    }
  };
}

export function showError(error) {
  let stdErr = error.capturedStandardError;
  if (stdErr) {
    stdErr = stdErr.trim();
    if (stdErr) {
      console.error(stdErr);
    }
  }

  if (process.env.RUN_DEBUG) {
    console.error(error);
    return;
  }

  if (error.hidden) {
    return;
  }

  console.error(error.message);

  if (error.contextStack) {
    for (const context of error.contextStack) {
      let identifier = gray((context.constructor && context.constructor.name) || 'Object');
      if (context.toIdentifier) {
        identifier += gray(': ') + formatString(context.toIdentifier());
      }
      console.error('  ' + identifier);
    }
  }
}

export function showErrorAndExit(error, code = 1) {
  showError(error);
  process.exit(code);
}

export function getRunningSymbol() {
  return '🏃';
}

export function getSuccessSymbol() {
  return '⚡';
}

export function getErrorSymbol() {
  return '😡';
}

export function adjustToWindowWidth(text, {leftMargin = 0, rightMargin = 0} = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('\'text\' must be a string');
  }

  if (!windowSize) {
    return text;
  }

  return sliceANSI(text, 0, windowSize.width - leftMargin - rightMargin);
}
