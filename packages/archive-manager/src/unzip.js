import {join, dirname} from 'path';
import {createWriteStream} from 'fs';
import yauzl from 'yauzl';
import {ensureDirSync} from 'fs-extra';

export function unzip(directory, archive) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(archive, {autoClose: false, lazyEntries: true}, (err, zipFile) => {
      if (err) {
        reject(err);
        return;
      }

      let streamCount = 1;

      function incrementStreamCount() {
        streamCount++;
      }

      function decrementStreamCount() {
        streamCount--;
        if (streamCount === 0) {
          resolve();
        }
      }

      zipFile.on('entry', entry => {
        zipFile.openReadStream(entry, (err, readStream) => {
          if (err) {
            reject(err);
            return;
          }

          const file = join(directory, entry.fileName);
          if (file.endsWith('/')) {
            // Handle directory
            ensureDirSync(file);
            zipFile.readEntry();
          } else {
            // Handle file
            readStream.on('end', () => {
              zipFile.readEntry();
            });
            ensureDirSync(dirname(file));
            const writeStream = createWriteStream(file);
            incrementStreamCount();
            readStream.pipe(writeStream);
            writeStream.once('close', () => decrementStreamCount());
          }
        });
      });

      zipFile.once('end', () => {
        zipFile.close();
        decrementStreamCount();
      });

      zipFile.readEntry();
    });
  });
}
