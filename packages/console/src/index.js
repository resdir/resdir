import pathModule from 'path';
const {resolve, relative} = pathModule;
import {entries, isPlainObject} from 'lodash';
import chalk from 'chalk';
const {cyan, yellow, green, red, magenta, gray, bold, underline, dim} = chalk;
import ora from 'ora';
import windowSize from 'window-size';
import sliceANSI from 'slice-ansi';
import read from 'read';
import wrapANSI from 'wrap-ansi';
import stringWidth from 'string-width';
import indentString from 'indent-string';
import {isClientError, isServerError, isRemoteError} from '@resdir/error';

if (global.resdirConsoleSessionsCount === undefined) {
  global.resdirConsoleSessionsCount = 0;
}

if (global.resdirConsoleEmptyLinesCount === undefined) {
  global.resdirConsoleEmptyLinesCount = 0;
}

if (global.resdirConsoleTaskStack === undefined) {
  global.resdirConsoleTaskStack = [];
}

export async function session(fn) {
  global.resdirConsoleSessionsCount++;
  if (global.resdirConsoleSessionsCount === 1) {
    global.resdirConsoleSessionIsEmpty = true;
  }
  try {
    return await fn();
  } finally {
    global.resdirConsoleSessionsCount--;
  }
}

export function print(message, environment) {
  _print({message, output: 'log'}, environment);
}

function _print({message, output}, environment) {
  if (environment && environment['@quiet']) {
    return;
  }
  pauseCurrentTasks();
  console[output](message);
  global.resdirConsoleSessionIsEmpty = false;
  resetEmptyLinesCount();
  resumeCurrentTasks();
}

export function emptyLine(count = 1, environment) {
  if (environment && environment['@quiet']) {
    return;
  }
  if (global.resdirConsoleSessionIsEmpty) {
    return;
  }
  for (let i = 0; i < count; i++) {
    if (getEmptyLinesCount() < count) {
      console.log('');
      incrementEmptyLinesCount();
    }
  }
}

function getEmptyLinesCount() {
  return global.resdirConsoleEmptyLinesCount;
}

function incrementEmptyLinesCount() {
  global.resdirConsoleEmptyLinesCount = getEmptyLinesCount() + 1;
}

function resetEmptyLinesCount() {
  global.resdirConsoleEmptyLinesCount = 0;
}

export function printProgress(message, environment) {
  print(formatMessage(message, {status: 'progress'}), environment);
}

export function printSuccess(message, environment) {
  print(formatMessage(message, {status: 'success'}), environment);
}

export function printText(text, options, environment) {
  print(formatText(text, options), environment);
}

export function printError(error, environment) {
  const debug = (environment && environment['@debug']) || process.env.DEBUG;

  if (!debug && (isClientError(error) || isServerError(error) || isRemoteError(error))) {
    _print({message: error.message, output: 'error'}, environment);
    return;
  }

  let stdErr = error.capturedStandardError;
  if (stdErr) {
    stdErr = stdErr.trim();
    if (stdErr) {
      _print({message: stdErr, output: 'error'}, environment);
    }
  }

  _print({message: error, output: 'error'}, environment);

  // if (debug) {
  //   _print({message: error, output: 'error'}, environment);
  //   return;
  // }
  //
  // if (error.hidden) {
  //   return;
  // }
  //
  // _print({message: error.message, output: 'error'}, environment);
  //
  // if (error.contextStack) {
  //   for (const context of error.contextStack) {
  //     let identifier = dim((context.constructor && context.constructor.name) || 'Object');
  //     if (context.toIdentifier) {
  //       identifier += dim(': ') + formatString(context.toIdentifier());
  //     }
  //     _print({message: '  ' + identifier, output: 'error'}, environment);
  //   }
  // }
}

export function printErrorAndExit(error, {code = 1} = {}, environment) {
  printError(error, environment);
  process.exit(code);
}

export function printWarning(message, environment) {
  _print({message, output: 'warn'}, environment);
}

export async function prompt(message, {type, default: defaultValue} = {}) {
  try {
    pauseCurrentTasks();
    return await new Promise((resolve, reject) => {
      global.resdirConsoleSessionIsEmpty = false;
      resetEmptyLinesCount();

      let prompt = `${dim('>')} ${message}`;
      if (defaultValue) {
        prompt += ` ${dim(`[${defaultValue}]`)}`;
      }

      const options = {prompt};

      if (type === 'PASSWORD') {
        options.silent = true;
        options.replace = '*';
        incrementEmptyLinesCount(); // Turn around a bug in 'read' module
      }

      read(options, (err, response) => {
        if (err) {
          return reject(err);
        }
        resolve(response || defaultValue);
      });
    });
  } finally {
    resumeCurrentTasks();
  }
}

export async function confirm(message, options = {}) {
  const choices = options.default === true ? 'Y|n' : 'y|N';
  const answer = await prompt(`${message} ${dim(`[${choices}]`)}`);
  if (!answer) {
    return options.default;
  }
  if (answer.toLowerCase().startsWith('y')) {
    return true;
  }
  return false;
}

export function formatValue(value, {maxWidth = 80, offset = 0, multiline = true} = {}) {
  if (value === undefined) {
    return formatUndefined();
  }
  if (value === null) {
    return formatNull();
  }
  if (typeof value === 'boolean') {
    return formatBoolean(value);
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  if (typeof value === 'string') {
    return formatString(value);
  }
  if (Array.isArray(value)) {
    return formatArray(value, {maxWidth, offset, multiline});
  }
  if (isPlainObject(value)) {
    return formatObject(value, {maxWidth, multiline});
  }
  throw new TypeError('\'value\' argument type is invalid');
}

export function formatBoolean(boolean) {
  if (boolean === undefined) {
    return formatUndefined();
  }
  if (typeof boolean !== 'boolean') {
    throw new TypeError(`'boolean' argument should be a boolean`);
  }
  boolean = boolean ? 'true' : 'false';
  return magenta(boolean);
}

export function formatNumber(number) {
  if (number === undefined) {
    return formatUndefined();
  }
  if (typeof number !== 'number') {
    throw new TypeError(`'number' argument should be a number`);
  }
  return green(Number(number));
}

export function formatString(string, {addQuotes = true} = {}) {
  if (string === undefined) {
    return formatUndefined();
  }
  string = String(string);
  if (addQuotes) {
    string = '\'' + string + '\'';
  }
  return yellow(string);
}

export function formatArray(
  array,
  {maxWidth = 80, multiline = true, offset = 0, direction = 'HORIZONTAL'} = {}
) {
  if (array === undefined) {
    return formatUndefined();
  }
  if (!Array.isArray(array)) {
    throw new TypeError(`'array' argument should be an array`);
  }
  let output = '';
  for (let value of array) {
    if (output) {
      output += formatPunctuation(',') + (direction === 'HORIZONTAL' ? ' ' : '\n');
    }
    value = formatValue(value, {maxWidth, multiline});
    output += value;
  }
  if (direction === 'VERTICAL') {
    output = '\n' + indentString(output, 2) + '\n';
  }
  output = formatPunctuation('[') + output + formatPunctuation(']');
  if (
    direction === 'HORIZONTAL' &&
    multiline &&
    (output.includes('\n') || stringWidth(output) > maxWidth - offset - 1)
  ) {
    return formatArray(array, {maxWidth: maxWidth - 2, multiline, direction: 'VERTICAL'});
  }
  return output;
}

export function formatObject(object, {maxWidth = 80, multiline = true} = {}) {
  if (object === undefined) {
    return formatUndefined();
  }
  if (!isPlainObject(object)) {
    throw new TypeError(`'object' argument should be a plain object`);
  }
  let output = '';
  for (let [key, value] of entries(object)) {
    if (output) {
      output += formatPunctuation(',') + (multiline ? '\n' : ' ');
    }
    key = formatKey(key);
    value = formatValue(value, {
      maxWidth: maxWidth - 2,
      multiline,
      offset: stringWidth(`${key}: `)
    });
    output += `${key}${formatPunctuation(':')} ${value}`;
  }
  if (output) {
    if (multiline) {
      output = indentString(output, 2);
    }
    output = `${formatPunctuation('{')}${multiline ? '\n' : ''}${output}${
      multiline ? '\n' : ''
    }${formatPunctuation('}')}`;
  } else {
    output = formatPunctuation('{}');
  }
  return output;
}

export function formatURL(url) {
  return cyan.underline(String(url));
}

export function formatPath(path = './', {addQuotes = true, baseDirectory, relativize} = {}) {
  if (baseDirectory) {
    path = resolve(baseDirectory, path);
  }

  if (relativize) {
    path = relative(baseDirectory, path);
    if (!path.startsWith('.')) {
      path = './' + path;
    }
  }

  if (addQuotes) {
    path = '\'' + path + '\'';
  }

  return yellow(path);
}

export function formatKey(key, {addQuotes} = {}) {
  if (typeof key !== 'string') {
    throw new TypeError('\'key\' argument should be a string');
  }

  if (addQuotes === undefined) {
    if (/^[^a-zA-Z_$]|[^0-9a-zA-Z_$]/.test(key)) {
      addQuotes = true;
    }
  }

  if (addQuotes) {
    key = '\'' + key + '\'';
  }

  return cyan(key);
}

export function formatCode(code, {addBackticks = true} = {}) {
  code = String(code);
  if (addBackticks) {
    code = '`' + code + '`';
  }
  return cyan(code);
}

export function formatBold(str) {
  return bold(String(str));
}

export function formatUnderline(str) {
  return underline(String(str));
}

export function formatDanger(str) {
  return red(String(str));
}

export function formatDim(str) {
  return dim(String(str));
}

export function formatPunctuation(str) {
  return gray(String(str));
}

export function formatExample(example) {
  return dim('(e.g., "' + String(example) + '")');
}

export function formatText(text, {width = 80, margins = {}, indentation} = {}) {
  let result = text;

  let leftMargin = margins.left || 0;
  if (indentation) {
    leftMargin += indentation;
  }

  if (width) {
    if (leftMargin) {
      width -= leftMargin;
    }
    result = wrapANSI(text, width, {trim: false});
  }

  if (leftMargin) {
    result = indentString(result, leftMargin);
  }

  return result;
}

export function formatTable(data = [], {allData = data, columnGap = 0, margins = {}} = {}) {
  const columnWidths = [];
  for (let row = 0; row < allData.length; row++) {
    const rowData = allData[row];
    for (let column = 0; column < rowData.length; column++) {
      if (columnWidths.length < column + 1) {
        columnWidths.push(0);
      }
      const cellData = _formatCellData(rowData[column]);
      const cellWidth = stringWidth(cellData);
      if (columnWidths[column] < cellWidth) {
        columnWidths[column] = cellWidth;
      }
    }
  }

  let output = '';
  for (let row = 0; row < data.length; row++) {
    if (row > 0) {
      output += '\n';
    }

    let rowOutput = ' '.repeat(margins.left || 0);
    const rowData = data[row];
    for (let column = 0; column < rowData.length; column++) {
      if (column > 0) {
        rowOutput += ' '.repeat(columnGap);
      }
      const columnWidth = columnWidths[column];
      const cellData = _formatCellData(rowData[column]);
      const cellWidth = stringWidth(cellData);
      rowOutput += cellData + ' '.repeat(columnWidth - cellWidth);
    }
    rowOutput = adjustToWindowWidth(rowOutput);

    output += rowOutput;
  }

  return output;
}

function _formatCellData(data) {
  if (data === undefined) {
    data = '';
  } else {
    data = String(data);
  }
  return data;
}

export function normalizeParagraph(text) {
  if (!text) {
    return '';
  }
  text = text.trim();
  const lastChar = text.substr(-1);
  if (lastChar !== '.' && lastChar !== '!' && lastChar !== '?') {
    text += '.';
  }
  return text;
}

export function formatMessage(message, {info, status} = {}) {
  message = String(message);

  if (info) {
    info = ' ' + dim(info);
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

export function formatUndefined(qualifier) {
  return dim(`<undefined${qualifier ? '-' + qualifier : ''}>`);
}

export function formatNull(qualifier) {
  return dim(`<null${qualifier ? '-' + qualifier : ''}>`);
}

export function getSuccessSymbol() {
  return emojisAreSupported() ? '⚡' : green('✓');
}

export function getErrorSymbol() {
  return emojisAreSupported() ? '😡' : red('✗');
}

export function getProgressSymbol() {
  return emojisAreSupported() ? '🏃' : yellow('⠒');
}

export function getProgressSpinner() {
  // Source: https://github.com/sindresorhus/cli-spinners
  return emojisAreSupported() ?
    {interval: 140, frames: ['🚶', '🏃']} :
    {
      interval: 80,
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(char => yellow(char))
    };
}

// let _emojisAreSupported;
export function emojisAreSupported() {
  return false;
  // Disabled because there is no way to be sure that emojis are correctly supported and rendered
  // For example:
  // - With the Menlo font, the ⚡ is dispayed in black and white,
  // - Since Apple Terminal 2.8 (400), emojis consumes two columns instead of one
  // if (_emojisAreSupported === undefined) {
  //   if (
  //     process.env.TERM_PROGRAM === 'Apple_Terminal' &&
  //     Number(process.env.TERM_PROGRAM_VERSION) >= 400
  //   ) {
  //     // macOS High Sierra Terminal
  //     _emojisAreSupported = true;
  //   } else {
  //     _emojisAreSupported = false;
  //   }
  // }
  // return _emojisAreSupported;
}

class AbstractTaskView {
  constructor({parent, outro}) {
    this.parent = parent;
    this.outro = outro;
  }

  start(message) {
    this.setMessage(message);
  }

  pause() {}

  resume() {}

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
    global.resdirConsoleSessionIsEmpty = false;
    resetEmptyLinesCount();
  }

  pause() {
    this.spinner.stop();
  }

  resume() {
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
    const info = views.map(view => '→ ' + view.message).join(' ');
    firstView.renderMessage({info});
  }
}

export async function task(fn, {intro, outro}, environment = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('\'fn\' must be a function');
  }

  const stack = global.resdirConsoleTaskStack;

  let ViewClass;
  if (environment['@quiet']) {
    ViewClass = QuietTaskView;
  } else if (stack.length > 0) {
    ViewClass = stack[0].constructor;
    if (ViewClass.name === 'AnimatedTaskView') {
      ViewClass = SubAnimatedTaskView;
    }
  } else if (environment['@verbose'] || environment['@debug'] || process.env.DEBUG) {
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

function pauseCurrentTasks() {
  for (const view of global.resdirConsoleTaskStack) {
    view.pause();
  }
}

function resumeCurrentTasks() {
  for (const view of global.resdirConsoleTaskStack) {
    view.resume();
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
