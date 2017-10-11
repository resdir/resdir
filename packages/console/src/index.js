import {gray, cyan, yellow, green, red} from 'chalk';
import ora from 'ora';
import windowSize from 'window-size';
import sliceANSI from 'slice-ansi';
import read from 'read';
import wrapANSI from 'wrap-ansi';

export function print(message, {output = 'log'} = {}) {
  console[output](message);
  resetEmptyLinesCount();
}

export function emptyLine(count = 1) {
  for (let i = 0; i < count; i++) {
    if (getEmptyLinesCount() < count) {
      console.log('');
      incrementEmptyLinesCount();
    }
  }
}

function getEmptyLinesCount() {
  return global.resdirConsoleEmptyLinesCount || 0;
}

function incrementEmptyLinesCount() {
  global.resdirConsoleEmptyLinesCount = getEmptyLinesCount() + 1;
}

function resetEmptyLinesCount() {
  global.resdirConsoleEmptyLinesCount = 0;
}

export function printProgress(message) {
  print(formatMessage(message, {status: 'progress'}));
}

export function printSuccess(message) {
  print(formatMessage(message, {status: 'success'}));
}

export function printText(text) {
  print(formatText(text));
}

export function printError(error) {
  let stdErr = error.capturedStandardError;
  if (stdErr) {
    stdErr = stdErr.trim();
    if (stdErr) {
      print(stdErr, {output: 'error'});
    }
  }

  if (process.env.DEBUG) {
    print(error, {output: 'error'});
    return;
  }

  if (error.hidden) {
    return;
  }

  print(error.message, {output: 'error'});

  if (error.contextStack) {
    for (const context of error.contextStack) {
      let identifier = gray((context.constructor && context.constructor.name) || 'Object');
      if (context.toIdentifier) {
        identifier += gray(': ') + formatString(context.toIdentifier());
      }
      print('  ' + identifier, {output: 'error'});
    }
  }
}

export function printErrorAndExit(error, code = 1) {
  printError(error);
  process.exit(code);
}

export function prompt(message, {type} = {}) {
  return new Promise((resolve, reject) => {
    resetEmptyLinesCount();

    const options = {prompt: `${gray('>>')} ${message}`};

    if (type === 'PASSWORD') {
      options.silent = true;
      options.replace = '*';
      incrementEmptyLinesCount(); // Turn around a bug in 'read' module
    }

    read(options, (err, response) => {
      if (err) {
        return reject(err);
      }
      resolve(response);
    });
  });
}

export async function confirm(message, options = {}) {
  const choices = options.default === true ? 'Y|n' : 'y|N';
  const answer = await prompt(`${message} ${gray(`[${choices}]`)}`);
  if (!answer) {
    return options.default;
  }
  if (answer.toLowerCase().startsWith('y')) {
    return true;
  }
  return false;
}

export function formatString(string) {
  if (string === undefined) {
    throw new TypeError('\'string\' is undefined');
  }
  return yellow('\'' + String(string) + '\'');
}

export function formatURL(url) {
  if (url === undefined) {
    throw new TypeError('\'url\' is undefined');
  }
  return cyan.underline(String(url));
}

export function formatPath(path) {
  if (path === undefined) {
    throw new TypeError('\'path\' is undefined');
  }
  return yellow('\'' + String(path) + '\'');
}

export function formatCode(code) {
  if (code === undefined) {
    throw new TypeError('\'code\' is undefined');
  }
  return cyan('`' + String(code) + '`');
}

export function formatExample(example) {
  if (example === undefined) {
    throw new TypeError('\'example\' is undefined');
  }
  return gray('(e.g., "' + String(example) + '")');
}

export function formatText(text, {width = 80} = {}) {
  return wrapANSI(text, width);
}

export function formatMessage(message, {info, status} = {}) {
  if (message === undefined) {
    throw new TypeError('\'message\' is undefined');
  }

  message = String(message);

  if (info) {
    if (!Array.isArray(info)) {
      info = [];
    }
    let str = '';
    for (const item of info) {
      str += ` ${gray(`→ ${item}`)}`;
    }
    info = str;
  } else {
    info = '';
  }

  if (status === 'progress') {
    status = getProgressSymbol() + ' ';
  } else if (status === 'success') {
    status = getSuccessSymbol() + ' ';
  } else if (status === 'error') {
    status = getErrorSymbol() + ' ';
  } else if (status === undefined) {
    status = '';
  } else {
    throw new Error('Invalid status: ' + status);
  }

  return `${status}${message}${info}`;
}

export function getSuccessSymbol() {
  return emojisAreSupported() ? '⚡' : green('✓');
}

export function getErrorSymbol() {
  return emojisAreSupported() ? '😡' : red('✗');
}

export function getProgressSymbol() {
  return emojisAreSupported() ? '🏃' : gray('⠒');
}

export function getProgressSpinner() {
  // Source: https://github.com/sindresorhus/cli-spinners
  return emojisAreSupported() ?
    {interval: 140, frames: ['🚶', '🏃']} :
    {
      interval: 80,
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(char => gray(char))
    };
}

let _emojisAreSupported;
export function emojisAreSupported() {
  // TODO: Support more terminals
  if (_emojisAreSupported === undefined) {
    if (
      process.env.TERM_PROGRAM === 'Apple_Terminal' &&
      Number(process.env.TERM_PROGRAM_VERSION) >= 400
    ) {
      // macOS High Sierra Terminal
      _emojisAreSupported = true;
    } else {
      _emojisAreSupported = false;
    }
  }
  return _emojisAreSupported;
}

class AbstractTaskView {
  constructor({parent, outro}) {
    this.parent = parent;
    this.outro = outro;
  }

  start(message) {
    this.setMessage(message);
  }

  complete() {}

  fail() {}

  setMessage(message) {
    this.message = message;
    this.renderMessage();
  }

  renderMessage() {}

  setOutro(message) {
    this.outro = message;
    return this;
  }
}

class QuietTaskView extends AbstractTaskView {}

class VerboseTaskView extends AbstractTaskView {
  complete() {
    super.complete();
    printSuccess(this.outro);
  }

  renderMessage() {
    printProgress(this.message);
  }
}

class AnimatedTaskView extends AbstractTaskView {
  constructor({parent, outro}) {
    super({parent, outro});
    this.spinner = ora({spinner: getProgressSpinner()});
  }

  start(message) {
    super.start(message);
    this.spinner.start();
    resetEmptyLinesCount();
  }

  complete() {
    this.spinner.stopAndPersist({text: this.outro, symbol: getSuccessSymbol()});
  }

  fail() {
    this.spinner.stopAndPersist({symbol: getErrorSymbol()});
  }

  renderMessage({info} = {}) {
    let message = this.message;
    if (info) {
      message = formatMessage(message, {info});
    }
    this.spinner.text = adjustToWindowWidth(message, {leftMargin: 3});
  }
}

class SubAnimatedTaskView extends AbstractTaskView {
  complete() {
    this.parent.renderMessage();
  }

  renderMessage() {
    const views = [];
    let view = this;
    do {
      views.unshift(view);
      view = view.parent;
    } while (view);

    const firstView = views.shift();
    const messages = views.map(view => view.message);
    firstView.renderMessage({info: messages});
  }
}

export async function task(fn, {intro, outro, verbose, debug, quiet}) {
  if (typeof fn !== 'function') {
    throw new TypeError('\'fn\' must be a function');
  }

  if (!global.resdirConsoleTaskStack) {
    global.resdirConsoleTaskStack = [];
  }

  const stack = global.resdirConsoleTaskStack;

  let ViewClass;
  if (stack.length > 0) {
    ViewClass = stack[0].constructor;
    if (ViewClass.name === 'AnimatedTaskView') {
      ViewClass = SubAnimatedTaskView;
    }
  } else if (quiet) {
    ViewClass = QuietTaskView;
  } else if (verbose || debug || process.env.DEBUG) {
    ViewClass = VerboseTaskView;
  } else {
    ViewClass = AnimatedTaskView;
  }

  const parent = stack[stack.length - 1];

  const view = new ViewClass({parent, outro});

  try {
    stack.push(view);
    view.start(intro);
    try {
      const result = await fn(view);
      view.complete();
      return result;
    } catch (err) {
      view.fail();
      throw err;
    }
  } finally {
    stack.pop();
  }
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

export function catchContext(context, fn) {
  const rethrow = err => {
    if (!err.contextStack) {
      err.contextStack = [];
    }
    err.contextStack.push(context);
    throw err;
  };

  try {
    let result = fn();
    if (result && typeof result.then === 'function') {
      result = result.catch(rethrow);
    }
    return result;
  } catch (err) {
    rethrow(err);
  }
}
