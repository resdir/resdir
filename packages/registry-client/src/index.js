import {join} from 'path';
import {existsSync, readFileSync} from 'fs';
import {homedir} from 'os';
import {outputFileSync, emptyDir} from 'fs-extra';
import {formatString, formatCode} from '@resdir/console';
import {load, save} from '@resdir/file-manager';
import {getScope, getIdentifier} from '@resdir/resource-name';
import {parse as parseSpecifier} from '@resdir/resource-specifier';

const RUN_DIRECTORY = join(homedir(), '.run');
const PUBLISHED_RESOURCES_DIRECTORY = join(RUN_DIRECTORY, 'published-resources');

export class RegistryClient {
  async fetch(specifier) {
    const {name} = parseSpecifier(specifier);

    const scope = getScope(name);
    if (!scope) {
      throw new Error(`Can't fetch a resource with a unscoped name: ${formatString(name)}`);
    }

    const identifier = getIdentifier(name);

    const publishedResourceDirectory = join(PUBLISHED_RESOURCES_DIRECTORY, scope, identifier);
    if (!existsSync(publishedResourceDirectory)) {
      throw new Error(`Can't find resource ${formatString(name)} in Resdir`);
    }

    const resourceFile = join(publishedResourceDirectory, '@resource.json');
    const definition = load(resourceFile);

    const archiveFile = join(publishedResourceDirectory, 'files.zip');
    const files = readFileSync(archiveFile);

    return {definition, files};
  }

  async publish(definition, files) {
    const name = definition['@name'];
    if (!name) {
      throw new Error(`Can't publish a resource without a ${formatCode('@name')} property`);
    }

    const scope = getScope(name);
    if (!scope) {
      throw new Error(`Can't publish a resource with a unscoped ${formatCode('@name')}`);
    }

    const identifier = getIdentifier(name);

    if (!definition['@version']) {
      throw new Error(`Can't publish a resource without a ${formatCode('@version')} property`);
    }

    const publishedResourceDirectory = join(PUBLISHED_RESOURCES_DIRECTORY, scope, identifier);

    await emptyDir(publishedResourceDirectory);

    const resourceFile = join(publishedResourceDirectory, '@resource.json');
    save(resourceFile, definition);

    const archiveFile = join(publishedResourceDirectory, 'files.zip');
    outputFileSync(archiveFile, files);
  }
}

export default RegistryClient;
