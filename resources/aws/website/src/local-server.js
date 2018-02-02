import {resolve, join} from 'path';
import {existsSync} from 'fs';
import {trim} from 'lodash';
import {print, printSuccess, formatDanger, formatDim, formatCode, formatURL} from '@resdir/console';
import Koa from 'koa';
import send from 'koa-send';
import createError from 'http-errors';
import isDirectory from 'is-directory';

export default () => ({
  createServer(environment) {
    const website = this.$getParent();
    const contentDirectory = resolve(website.$getCurrentDirectory(), website.contentDirectory);
    const indexPage = website.indexPage;
    const customErrors = website.customErrors || [];

    const server = new Koa();

    server.use(async ctx => {
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
          message += formatDim(` (`);
          if (status !== 200) {
            const err = createError(status);
            message += formatDanger(`${err.status} ${err.message} `);
          }
          message += formatDim(`=> ${servedPath})`);
        }

        print(message, environment);

        ctx.status = status;
        await send(ctx, path, {root: contentDirectory});
      } catch (err) {
        message += formatDim(` (`) + formatDanger(`${err.status} ${err.message}`) + formatDim(`)`);
        print(message, environment);
        throw err;
      }
    });

    return server;
  },

  async start(_input, environment) {
    const server = this.createServer(environment);
    server.listen(this.port);
    printSuccess(
      `Local server started ${formatDim(`(`)}${formatURL(`http://localhost:${this.port}`)}${formatDim(`)`)}`,
      environment
    );
  }
});
