import {resolve, dirname, isAbsolute} from 'path';
import {existsSync} from 'fs';
import {task, formatString, formatCode, formatPath} from '@resdir/console';
import {stringifyResourceSpecifier} from '@resdir/resource-specifier';
import {put} from '@resdir/http-client';
import {gzipSync} from 'zlib';
import {zip} from '@resdir/archive-manager';
import readDirectory from 'recursive-readdir';
import isDirectory from 'is-directory';
import generateSecret from '@resdir/secret-generator';
import hasha from 'hasha';

export default base =>
  class Resources extends base {
    async get({specifier, throwIfNotFound}, environment) {
      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      return await task(
        async progress => {
          const {resource} = await root.authenticatedCall(
            accessToken =>
              server.getResource(
                {
                  specifier,
                  throwIfNotFound,
                  accessToken
                },
                environment
              ),
            environment
          );
          if (resource) {
            const resourceSpecifier = stringifyResourceSpecifier({
              identifier: resource.identifier,
              versionRange: resource.version
            });
            progress.setOutro(`Resource found (${formatString(resourceSpecifier)})`);
          } else {
            progress.setOutro(`Resource not found (${formatString(specifier)})`);
          }
          return {resource};
        },
        {
          intro: `Getting resource (${formatString(specifier)})...`
        },
        environment
      );
    }

    async fetch({specifier}, environment) {
      const root = this.$getRoot();
      const resourceFetcher = await root.constructor.$getResourceFetcher();

      const {file, cacheStatus} = await root.authenticatedCall(
        accessToken => resourceFetcher.fetch({specifier, accessToken}, environment),
        environment
      );

      return {file, cacheStatus};
    }

    async publish({file, permissionToken}, environment) {
      if (!isAbsolute(file)) {
        file = resolve(process.cwd(), file);
      }

      const root = this.$getRoot();
      const server = await root.getRegistryServer();

      root.ensureSignedInUser();

      const resource = await root.constructor.$load(file);
      const definition = resource.$serialize({publishing: true});

      const {id: identifier, version, isPublic} = definition;

      if (!identifier) {
        throw new Error(`Can't publish a resource without a ${formatCode('id')} property`);
      }

      if (!version) {
        throw new Error(`Can't publish a resource without a ${formatCode('version')} property`);
      }

      const specifier = stringifyResourceSpecifier({identifier, versionRange: version});

      const uploads = [];

      if (!root.uploadServer) {
        throw new Error(`'uploadServer' attribute is missing`);
      }
      const {bucketName, keyPrefix} = root.uploadServer.config;

      const compressedDefinition = gzipSync(JSON.stringify(definition));
      const definitionKey = keyPrefix + generateSecret() + '.json.gz';
      uploads.push(this._uploadToS3({
        bucket: bucketName,
        key: definitionKey,
        body: compressedDefinition
      }));

      const directory = dirname(file);
      const files = await this._getFiles(definition, directory);
      if (files.length > 0) {
        // TODO: Instead of a buffer, use a stream to zip and upload files
        const compressedFiles = await zip(directory, files);
        const filesKey = keyPrefix + generateSecret() + '.zip';
        uploads.push(this._uploadToS3({
          bucket: bucketName,
          key: filesKey,
          body: compressedFiles
        }));
      }

      const [temporaryDefinitionURL, temporaryFilesURL] = await Promise.all(uploads);

      await task(
        async () => {
          await root.authenticatedCall(
            accessToken =>
              server.publishResource(
                {
                  identifier,
                  version,
                  isPublic,
                  temporaryDefinitionURL,
                  temporaryFilesURL,
                  permissionToken,
                  accessToken
                },
                environment
              ),
            environment
          );
        },
        {
          intro: `Publishing resource (${formatString(specifier)})...`,
          outro: `Resource published (${formatString(specifier)})`
        },
        environment
      );

      const resourceFetcher = await root.constructor.$getResourceFetcher();
      await resourceFetcher.invalidateResourceCache(identifier, version);
    }

    async _uploadToS3({bucket, key, body}) {
      const url = `https://${bucket}.s3.amazonaws.com/${key}`;
      const md5 = await hasha(body, {algorithm: 'md5', encoding: 'base64'});
      await put(url, body, {
        headers: {
          'Content-MD5': md5,
          'Content-Length': body.length,
          'x-amz-acl': 'bucket-owner-full-control'
        }
      });
      return url;
    }

    async _getFiles(definition, directory) {
      const files = [];

      const filesProperty = definition.files || [];
      for (const file of filesProperty) {
        const resolvedFile = resolve(directory, file);

        if (!existsSync(resolvedFile)) {
          throw new Error(`File ${formatPath(file)} specified in ${formatCode('files')} property doesn't exist`);
        }

        if (isDirectory.sync(resolvedFile)) {
          const newFiles = await readDirectory(resolvedFile);
          files.push(...newFiles);
        } else {
          files.push(resolvedFile);
        }
      }

      return files;
    }
  };
