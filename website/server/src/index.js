import {join, resolve} from 'path';
import {existsSync} from 'fs';
import {print, printSuccess} from '@resdir/console';
import Koa from 'koa';
import send from 'koa-send';

export default base =>
  class Server extends base {
    async start() {
      const contentDirectory = resolve(this.$getCurrentDirectory(), this.contentDirectory);
      const port = this.port;

      const app = new Koa();

      app.use(async ctx => {
        let path = ctx.path;
        if (path.startsWith('/')) {
          path = path.slice(1);
        }
        if (!(path && existsSync(join(contentDirectory, path)))) {
          path = 'index.html';
        }
        print(`${ctx.path} => ${path}`);
        await send(ctx, path, {root: contentDirectory});
      });

      app.listen(port);

      printSuccess(`Server started (port: ${port})`);
    }
  };
