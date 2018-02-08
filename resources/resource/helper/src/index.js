import {extname} from 'path';
import {unlinkSync} from 'fs';
import assert from 'assert';
import {pull, upperFirst, compact} from 'lodash';
import {
  task,
  formatValue,
  formatString,
  formatPath,
  formatCode,
  formatBold,
  formatUnderline,
  formatDim,
  formatUndefined,
  print,
  printText,
  printSuccess,
  emptyLine,
  formatTable
} from '@resdir/console';
import indentString from 'indent-string';
import {parseResourceSpecifier, stringifyResourceSpecifier} from '@resdir/resource-specifier';

export default Resource => ({
  async create({typeOrSpecifier}, environment) {
    let type;
    let specifier;
    if (Resource.$isTypeIdentifier(typeOrSpecifier)) {
      type = typeOrSpecifier;
    } else {
      specifier = typeOrSpecifier;
    }

    await task(
      async () => {
        const directory = process.cwd();

        const existingResource = await Resource.$load(directory, {
          throwIfNotFound: false
        });
        if (existingResource) {
          throw new Error(`A resource already exists in the current directory`);
        }

        const definition = {};
        if (specifier) {
          specifier = await this._pinResource(specifier);
          definition['@import'] = specifier;
        }
        if (type) {
          definition['@type'] = type;
        }

        const resource = await Resource.$create(definition, {directory});
        await resource.$broadcast('@created');
        await resource.$save();
      },
      {
        intro: `Creating resource...`,
        outro: `Resource created`
      },
      environment
    );
  },

  async add({resourcePtr, typeOrSpecifier, key}, environment) {
    const resource = resourcePtr.$target;

    let type;
    let specifier;
    if (Resource.$isTypeIdentifier(typeOrSpecifier)) {
      type = typeOrSpecifier;
    } else {
      specifier = typeOrSpecifier;
    }

    if (!key) {
      throw new Error(`${formatCode('key')} input attribute is missing`);
    }

    let child = resource.$getChild(key);
    if (child) {
      throw new Error(`A property with the same key (${formatCode(key)}) already exists`);
    }

    child = await task(
      async () => {
        const definition = {};
        if (specifier) {
          specifier = await this._pinResource(specifier);
          definition['@import'] = specifier;
        }
        if (type) {
          definition['@type'] = type;
        }

        child = await resource.$setChild(key, definition);
        await child.$broadcast('@created');
        await resource.$save();
      },
      {
        intro: `Adding property...`,
        outro: `Property added`
      },
      environment
    );
  },

  async remove({resourcePtr, key}, environment) {
    const resource = resourcePtr.$target;

    const child = resource.$getChild(key);
    if (!child) {
      throw new Error(`Property not found (key: ${formatCode(key)})`);
    }

    await task(
      async () => {
        await resource.$removeChild(key);
        await resource.$save();
      },
      {
        intro: `Removing property...`,
        outro: `Property removed`
      },
      environment
    );
  },

  async _pinResource(specifier) {
    const {identifier, versionRange, location} = parseResourceSpecifier(specifier);
    if (location) {
      return specifier;
    }
    if (versionRange.toJSON() === undefined) {
      const resource = await Resource.$load(identifier);
      if (resource.version) {
        specifier = stringifyResourceSpecifier({
          identifier,
          versionRange: '^' + resource.version
        });
      }
    }
    return specifier;
  },

  // find . -name "@resource.json5" -exec run {} @normalize --json \;
  async normalize({resourcePtr, format}, environment) {
    const resource = resourcePtr.$target;

    format = format.toUpperCase();

    const file = resource.$getResourceFile();
    if (!file) {
      throw new Error('Resource file is undefined');
    }

    let newFile;
    const extension = extname(file);

    const convertToJSON = format === 'JSON' && extension !== '.json';
    if (convertToJSON) {
      newFile = file.slice(0, -extension.length) + '.json';
    }

    const convertToJSON5 = format === 'JSON5' && extension !== '.json5';
    if (convertToJSON5) {
      newFile = file.slice(0, -extension.length) + '.json5';
    }

    const convertToYAML = format === 'YAML' && extension !== '.yaml';
    if (convertToYAML) {
      newFile = file.slice(0, -extension.length) + '.yaml';
    }

    if (newFile) {
      resource.$setResourceFile(newFile);
    }

    await resource.$save();

    if (newFile) {
      unlinkSync(file);
    }

    printSuccess('Resource file normalized', environment);
  },

  async help({resourcePtr, keys, showNative}) {
    const resource = resourcePtr.$target;
    await this._help(resource, {keys, showNative});
  },

  async _help(resource, {keys, showNative}) {
    const type = resource.$getType();

    keys = keys ? [...keys] : [];
    const key = keys.shift();
    if (key) {
      let child;
      if (type === 'method') {
        const input = resource.$getInput();
        child = input && input.$findChild(key);
        if (!child) {
          const output = resource.$getOutput();
          child = output && output.$findChild(key);
          if (!child) {
            throw new Error(`No method input or output attribute found with this key: ${formatCode(key)}`);
          }
        }
      } else {
        child = resource.$findChild(key, {includeNativeChildren: true});
        if (!child) {
          throw new Error(`No attribute or method found with this key: ${formatCode(key)}`);
        }
        child = await child.$resolveGetter({parent: resource});
      }
      return await this._help(child, {keys, showNative});
    }

    this._print(resource, {showNative});

    if (!showNative) {
      emptyLine();
      print(formatDim(`(use ${formatCode('@@help')} to display native attributes and methods)`));
    }
  },

  _print(resource, {indentation = 0, showNative} = {}) {
    const type = resource.$getType();
    this._printKeyAndType(resource, {indentation});
    this._printDescription(resource, {indentation});
    if (!showNative) {
      this._printDefault(resource, {indentation});
      this._printAliases(resource, {indentation});
      this._printPosition(resource, {indentation});
      this._printIsOptional(resource, {indentation});
      this._printIsVariadic(resource, {indentation});
      this._printIsSubInput(resource, {indentation});
      this._printExamples(resource, {indentation});
      if (type === 'method') {
        this._printMethodListens(resource, {indentation});
        this._printMethodInput(resource, {indentation});
        this._printMethodOutput(resource, {indentation});
      }
    }
    this._printChildren(resource, {indentation, showNative});
  },

  _printKeyAndType(resource, {indentation}) {
    const key = resource.$getKey();
    if (key) {
      const formattedType = this._formatType(resource);
      emptyLine();
      printText(
        formatBold(formatCode(key, {addBackticks: false}) + ' ' + formatDim(`(${formattedType})`)),
        {width: null, indentation}
      );
    }
  },

  _printDescription(resource, {indentation}) {
    const description = resource.$description;
    if (description) {
      printText(description, {width: null, indentation});
    }
  },

  _printDefault(resource, {indentation}) {
    const defaultValue = this._formatDefault(resource);
    if (defaultValue) {
      emptyLine();
      printText(upperFirst(defaultValue), {width: null, indentation});
    }
  },

  _printAliases(resource, {indentation}) {
    const aliases = this._formatAliases(resource, {removeKey: true});
    if (aliases) {
      emptyLine();
      printText(upperFirst(aliases), {width: null, indentation});
    }
  },

  _printPosition(resource, {indentation}) {
    const position = this._formatPosition(resource);
    if (position) {
      emptyLine();
      printText(upperFirst(position), {width: null, indentation});
    }
  },

  _printIsOptional(resource, {indentation}) {
    const isOptional = this._formatIsOptional(resource);
    if (isOptional) {
      emptyLine();
      printText(upperFirst(isOptional), {width: null, indentation});
    }
  },

  _printIsVariadic(resource, {indentation}) {
    const isVariadic = this._formatIsVariadic(resource);
    if (isVariadic) {
      emptyLine();
      printText(upperFirst(isVariadic), {width: null, indentation});
    }
  },

  _printIsSubInput(resource, {indentation}) {
    const isSubInput = this._formatIsSubInput(resource);
    if (isSubInput) {
      emptyLine();
      printText(upperFirst(isSubInput), {width: null, indentation});
    }
  },

  _printExamples(resource, {indentation}) {
    let formattedExamples;

    const examples = resource.$examples;
    if (examples && examples.length === 1) {
      formattedExamples = 'Example:';
      const example = this._formatExample(resource, examples[0]);
      if (example.includes('\n')) {
        formattedExamples += '\n' + indentString(example, 2);
      } else {
        formattedExamples += ' ' + example;
      }
    } else if (examples && examples.length > 1) {
      formattedExamples = 'Examples:';
      for (let example of examples) {
        example = this._formatExample(resource, example);
        formattedExamples += '\n' + indentString(example, 2);
      }
    }

    if (formattedExamples !== undefined) {
      emptyLine();
      printText(formattedExamples, {width: null, indentation});
    }
  },

  _printMethodListens(resource, {indentation}) {
    const listens = this._formatMethodListens(resource);
    if (listens) {
      emptyLine();
      printText(upperFirst(listens), {width: null, indentation});
    }
  },

  _printMethodInput(resource, {indentation}) {
    this.__printMethodInputOrOutput(resource, 'INPUT', {indentation});
  },

  _printMethodOutput(resource, {indentation}) {
    this.__printMethodInputOrOutput(resource, 'OUTPUT', {indentation});
  },

  __printMethodInputOrOutput(resource, attribute, {indentation}) {
    resource = attribute === 'INPUT' ? resource.$getInput() : resource.$getOutput();

    if (resource === undefined) {
      return;
    }

    const type = resource.$getType();

    emptyLine();
    printText(formatUnderline(attribute === 'INPUT' ? 'Input' : 'Output'), {
      width: null,
      indentation
    });

    if (type !== 'resource' || !resource.$hasChildren({includeHiddenChildren: false})) {
      emptyLine();
      printText(this._formatType(resource), {width: null, indentation});
    }

    this._print(resource, {indentation: indentation + 2});
  },

  _printChildren(resource, {indentation, showNative}) {
    const sections = [];
    const allData = [];

    resource.$forEachChild(
      child => {
        if (child.$isHidden) {
          return;
        }

        const creator = child.$getCreator();
        assert(creator, 'A resource child should always have a creator');

        let section = sections.find(section => section.creator === creator);
        if (!section) {
          section = {creator, attributes: [], methods: []};
          sections.push(section);
        }

        const formattedChild = this._formatChild(child);
        const type = child.$getType();
        section[type === 'method' ? 'methods' : 'attributes'].push(formattedChild);
        allData.push(formattedChild);
      },
      {includeResourceChildren: !showNative, includeNativeChildren: showNative}
    );

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      const title = showNative ?
        this._formatType(section.creator) :
        this._formatResourceSpecifier(section.creator, {directory: process.cwd()});
      if (title) {
        emptyLine();
        printText(formatBold(title), {width: null, indentation});
      }

      if (section.attributes.length) {
        emptyLine();
        printText('Attributes:', {width: null, indentation});
        print(formatTable(section.attributes, {
          allData,
          columnGap: 2,
          margins: {left: indentation + 2}
        }));
      }

      if (section.methods.length) {
        emptyLine();
        printText('Methods:', {width: null, indentation});
        print(formatTable(section.methods, {allData, columnGap: 2, margins: {left: indentation + 2}}));
      }
    }
  },

  _formatChild(child) {
    const type = child.$getType();

    const key = child.$getKey();
    let formattedKey = formatCode(key, {addBackticks: false});
    if (type !== 'method') {
      let formattedType = this._formatType(child);
      formattedType = formatDim(`(${formattedType})`);
      formattedKey += ' ' + formattedType;
    }

    const description = child.$description;
    let formattedDescription = description || '';
    let attributes = [
      this._formatDefault(child),
      this._formatAliases(child, {removeKey: true}),
      this._formatPosition(child),
      this._formatIsOptional(child, {shorten: true}),
      this._formatIsVariadic(child, {shorten: true}),
      this._formatIsSubInput(child, {shorten: true})
    ];
    attributes = compact(attributes);
    if (attributes.length) {
      if (formattedDescription) {
        formattedDescription += ' ';
      }
      formattedDescription += formatDim(`(${attributes.join('; ')})`);
    }

    return [formattedKey, formattedDescription];
  },

  _formatType(resource) {
    if (resource.$getGetter()) {
      return 'getter';
    }
    const type = resource.$getType();
    if (type === 'method') {
      return resource.$getIsNative() ? 'native method' : 'method';
    }
    if (type === 'resource') {
      return 'resource';
    }
    if (resource.$hasChildren({includeHiddenChildren: false})) {
      return type + '*';
    }
    return type;
  },

  _formatResourceSpecifier(resource, {directory}) {
    const specifier = resource.$getResourceSpecifier();
    if (!specifier) {
      return undefined;
    }

    const parsedSpecifier = parseResourceSpecifier(specifier);
    if (parsedSpecifier.location) {
      const file = resource.$getResourceFile();
      if (!file) {
        return formatUndefined('file');
      }
      return formatPath(file, {addQuotes: false, baseDirectory: directory, relativize: true});
    }

    return formatString(specifier, {addQuotes: false});
  },

  _formatDefault(resource) {
    const defaultValue = resource.$default;
    if (defaultValue === undefined) {
      return '';
    }
    return 'default: ' + formatValue(defaultValue, {multiline: false});
  },

  _formatAliases(resource, {removeKey} = {}) {
    let aliases = resource.$aliases;
    if (aliases === undefined) {
      return '';
    }
    if (removeKey) {
      const key = resource.$getKey();
      if (key) {
        pull(aliases, key);
      }
    }
    if (aliases.length === 0) {
      return '';
    }
    aliases = aliases.map(alias => formatCode(alias, {addBackticks: false}));
    if (aliases.length === 1) {
      return 'alias: ' + aliases[0];
    }
    return 'aliases: ' + aliases.join(', ');
  },

  _formatPosition(resource) {
    const position = resource.$position;
    if (position === undefined) {
      return '';
    }
    return 'position: ' + formatValue(position);
  },

  _formatIsOptional(resource, {shorten} = {}) {
    const isOptional = resource.$isOptional;
    if (isOptional === undefined) {
      return '';
    }
    if (shorten) {
      return isOptional ? 'optional' : '';
    }
    return 'optional: ' + formatValue(isOptional);
  },

  _formatIsVariadic(resource, {shorten} = {}) {
    const isVariadic = resource.$isVariadic;
    if (isVariadic === undefined) {
      return '';
    }
    if (shorten) {
      return isVariadic ? 'variadic' : '';
    }
    return 'variadic: ' + formatValue(isVariadic);
  },

  _formatIsSubInput(resource, {shorten} = {}) {
    const isSubInput = resource.$isSubInput;
    if (isSubInput === undefined) {
      return '';
    }
    if (shorten) {
      return isSubInput ? 'sub-input' : '';
    }
    return 'sub-input: ' + formatValue(isSubInput);
  },

  _formatExample(resource, example) {
    const type = resource.$getType();
    if (type === 'method') {
      return formatCode(example, {addBackticks: false});
    }
    return formatValue(example, {maxWidth: 78});
  },

  _formatMethodListens(resource) {
    let events = resource.$getAllListenedEvents();
    if (!events.length) {
      return '';
    }
    events = events.map(alias => formatString(alias, {addQuotes: false}));
    return 'listens: ' + events.join(', ');
  }
});
