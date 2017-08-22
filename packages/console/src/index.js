import {gray, cyan, yellow} from 'chalk';
import ora from 'ora';
import cliSpinners from 'cli-spinners';
import windowSize from 'window-size';
import sliceANSI from 'slice-ansi';

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
    console.log(getSuccessSymbol() + '  ' + this.outro);
  }

  renderMessage() {
    console.log(getRunningSymbol() + '  ' + this.message);
  }
}

class AnimatedTaskView extends AbstractTaskView {
  constructor({parent, outro}) {
    super({parent, outro});
    this.spinner = ora({spinner: cliSpinners.runner});
  }

  start(message) {
    super.start(message);
    this.spinner.start();
  }

  complete() {
    this.spinner.stopAndPersist({text: this.outro, symbol: getSuccessSymbol() + ' '});
  }

  fail() {
    this.spinner.stopAndPersist({symbol: getErrorSymbol() + ' '});
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

export function showError(error) {
  let stdErr = error.capturedStandardError;
  if (stdErr) {
    stdErr = stdErr.trim();
    if (stdErr) {
      console.error(stdErr);
    }
  }

  if (process.env.DEBUG) {
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
