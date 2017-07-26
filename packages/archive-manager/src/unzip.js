import {join, dirname} from 'path';
import {createWriteStream} from 'fs';
import yauzl from 'yauzl';
import {ensureDirSync} from 'fs-extra';

export function unzip(directory, archive) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(archive, {lazyEntries: true}, (err, zipFile) => {
      if (err) {
        reject(err);
        return;
      }

      zipFile.on('entry', entry => {
        zipFile.openReadStream(entry, (err, readStream) => {
          if (err) {
            reject(err);
            return;
          }

          readStream.on('end', () => {
            zipFile.readEntry();
          });

          const file = join(directory, entry.fileName);
          ensureDirSync(dirname(file));
          const writeStream = createWriteStream(file);
          readStream.pipe(writeStream);
        });
      });

      zipFile.on('end', () => {
        resolve();
      });

      zipFile.readEntry();
    });
  });
}
