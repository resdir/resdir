import {resolve, join} from 'path';
import {existsSync} from 'fs';
import {trim} from 'lodash';
import {
  print,
  printSuccess,
  formatDanger,
  formatPunctuation,
  formatCode,
  formatURL
} from '@resdir/console';
import Koa from 'koa';
import cors from '@koa/cors';
import send from 'koa-send';
import createError from 'http-errors';
import isDirectory from 'is-directory';
import notifier from 'node-notifier';
import sleep from 'sleep-promise';

export default () => ({
  createServer(environment) {
    const website = this.$getParent();
    const contentDirectory = resolve(website.$getCurrentDirectory(), website.contentDirectory);
    const indexPage = website.indexPage;
    const customErrors = website.customErrors || [];

    const server = new Koa();

    server.use(cors());

    server.use(async ctx => {
      if (this.delay) {
        await sleep(this.delay);
      }

      let message = `${formatCode('GET', {addBackticks: false})} ${ctx.path}`;

      try {
        if (ctx.method.toUpperCase() !== 'GET') {
          throw createError(405);
        }

        let path = trim(ctx.path, '/');
        let status = 200;

        let file = join(contentDirectory, path);
        if (isDirectory.sync(file)) {
          path = join(path, indexPage);
          file = join(contentDirectory, path);
        }

        if (!existsSync(file)) {
          const notFoundError = customErrors.find(({errorCode}) => errorCode === 404);
          if (!notFoundError) {
            throw createError(404);
          }
          status = notFoundError.responseCode || 404;
          path = notFoundError.responsePage;
        }

        const servedPath = '/' + path;
        if (ctx.path !== servedPath) {
          message += formatPunctuation(` (`);
          if (status !== 200) {
            const err = createError(status);
            message += formatDanger(`${err.status} ${err.message} `);
          }
          message += formatPunctuation('=> ') + servedPath + formatPunctuation(')');
        }

        print(message, environment);

        ctx.status = status;
        await send(ctx, path, {root: contentDirectory});
      } catch (err) {
        message +=
          formatPunctuation(` (`) +
          formatDanger(`${err.status} ${err.message}`) +
          formatPunctuation(`)`);
        print(message, environment);
        throw err;
      }
    });

    return server;
  },

  async start({notify}, environment) {
    const server = this.createServer(environment);
    server.listen(this.port);
    printSuccess(
      `Test server started ${formatPunctuation(`(`)}${formatURL(`http://localhost:${this.port}`)}${formatPunctuation(`)`)}`,
      environment
    );
    if (notify) {
      notifier.notify({title: 'Test server started', message: `http://localhost:${this.port}`});
    }
  }
});
