import {resolve as resolvePath, relative} from 'path';
import {ZipFile} from 'yazl';
import streamBuffers from 'stream-buffers';
import {formatPath} from '@resdir/console';

export function zip(rootDirectory, files) {
  return new Promise((resolve, _reject) => {
    const zipFile = new ZipFile();

    const output = new streamBuffers.WritableStreamBuffer();

    output.on('finish', () => {
      resolve(output.getContents());
    });

    zipFile.outputStream.pipe(output);

    for (const file of files) {
      const realPath = resolvePath(rootDirectory, file);

      const metadataPath = relative(rootDirectory, realPath);
      if (metadataPath.startsWith('..')) {
        throw new Error(
          `Cannot zip a file (${formatPath(
            file
          )}) located outside of the root directory (${formatPath(rootDirectory)})`
        );
      }

      zipFile.addFile(realPath, metadataPath);
    }

    zipFile.end();
  });
}
