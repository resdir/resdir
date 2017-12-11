import {resolve, relative} from 'path';
import entries from 'lodash/entries';
import isPlainObject from 'lodash/isPlainObject';
import {cyan, yellow, green, red, magenta, gray, bold, underline, dim} from 'chalk';
import ora from 'ora';
import windowSize from 'window-size';
import sliceANSI from 'slice-ansi';
import read from 'read';
import wrapANSI from 'wrap-ansi';
import stringWidth from 'string-width';
import indentString from 'indent-string';

if (global.resdirConsoleSessionsCount === undefined) {
  global.resdirConsoleSessionsCount = 0;
}

if (global.resdirConsoleEmptyLinesCount === undefined) {
  global.resdirConsoleEmptyLinesCount = 0;
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

export function print(message, {output = 'log'} = {}) {
  console[output](message);
  global.resdirConsoleSessionIsEmpty = false;
  resetEmptyLinesCount();
}

export function emptyLine(count = 1) {
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
      let identifier = dim((context.constructor && context.constructor.name) || 'Object');
      if (context.toIdentifier) {
        identifier += dim(': ') + formatString(context.toIdentifier());
      }
      print('  ' + identifier, {output: 'error'});
    }
  }
}

export function printErrorAndExit(error, code = 1) {
  printError(error);
  process.exit(code);
}

export function prompt(message, {type, default: defaultValue} = {}) {
  return new Promise((resolve, reject) => {
    global.resdirConsoleSessionIsEmpty = false;
    resetEmptyLinesCount();

    let prompt = `${dim('>>')} ${message}`;
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

export function formatValue(value, {maxWidth = 80, offset = 0} = {}) {
  if (value === undefined) {
    return formatUndefined();
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
    return formatArray(value, {maxWidth, offset});
  }
  if (isPlainObject(value)) {
    return formatObject(value, {maxWidth});
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

export function formatArray(array, {maxWidth = 80, offset = 0, direction = 'HORIZONTAL'} = {}) {
  if (array === undefined) {
    return formatUndefined();
  }
  if (!Array.isArray(array)) {
    throw new TypeError(`'array' argument should be an array`);
  }
  let output = '';
  for (let value of array) {
    if (output) {
      output += gray(',') + (direction === 'HORIZONTAL' ? ' ' : '\n');
    }
    value = formatValue(value, {maxWidth});
    output += value;
  }
  if (direction === 'VERTICAL') {
    output = '\n' + indentString(output, 2) + '\n';
  }
  output = gray('[') + output + gray(']');
  if (
    direction === 'HORIZONTAL' &&
    (output.includes('\n') || stringWidth(output) > maxWidth - offset - 1)
  ) {
    return formatArray(array, {maxWidth: maxWidth - 2, direction: 'VERTICAL'});
  }
  return output;
}

export function formatObject(object, {maxWidth = 80} = {}) {
  if (object === undefined) {
    return formatUndefined();
  }
  if (!isPlainObject(object)) {
    throw new TypeError(`'object' argument should be a plain object`);
  }
  let output = '';
  for (let [key, value] of entries(object)) {
    if (output) {
      output += gray(',') + '\n';
    }
    key = formatKey(key);
    value = formatValue(value, {maxWidth: maxWidth - 2, offset: stringWidth(`${key}: `)});
    output += `${key}${gray(':')} ${value}`;
  }
  if (output) {
    output = indentString(output, 2);
    output = `${gray('{')}\n${output}\n${gray('}')}`;
  } else {
    output = gray('{}');
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

export function formatDim(str) {
  return dim(String(str));
}

export function formatExample(example) {
  return dim('(e.g., "' + String(example) + '")');
}

export function formatText(text, {width = 80} = {}) {
  return wrapANSI(text, width);
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

export async function task(fn, {intro, outro, verbose, debug, quiet}) {
  if (typeof fn !== 'function') {
    throw new TypeError('\'fn\' must be a function');
  }

  if (!global.resdirConsoleTaskStack) {
    global.resdirConsoleTaskStack = [];
  }

  const stack = global.resdirConsoleTaskStack;

  let ViewClass;
  if (quiet) {
    ViewClass = QuietTaskView;
  } else if (stack.length > 0) {
    ViewClass = stack[0].constructor;
    if (ViewClass.name === 'AnimatedTaskView') {
      ViewClass = SubAnimatedTaskView;
    }
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
