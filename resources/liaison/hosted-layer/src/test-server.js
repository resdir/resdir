import {resolve} from 'path';
import {
  print,
  printSuccess,
  formatBold,
  formatCode,
  formatValue,
  formatPunctuation,
  formatURL
} from '@resdir/console';
import Koa from 'koa';
import jsonError from 'koa-json-error';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import notifier from 'node-notifier';
import sleep from 'sleep-promise';

export default () => ({
  async start({notify}, environment) {
    const layer = this.getLayer();

    const server = this.createServer(layer, environment);

    server.listen(this.port, () => {
      // TODO: Handle errors
      printSuccess(
        `Test server started ${formatPunctuation(`(`)}${formatURL(
          `http://localhost:${this.port}`
        )}${formatPunctuation(`)`)}`,
        environment
      );
      if (notify) {
        notifier.notify({title: 'Test server started', message: `http://localhost:${this.port}`});
      }
    });
  },

  getLayer() {
    const parentResource = this.$getParent();
    const main = resolve(parentResource.$getCurrentDirectory(), parentResource.main);
    let layer = require(main);
    if (layer.default) {
      // ES Module
      layer = layer.default;
    }
    return layer;
  },

  createServer(layer, _environment) {
    const server = new Koa();

    server.use(jsonError());
    server.use(cors({maxAge: 900})); // 15 minutes
    server.use(bodyParser({enableTypes: ['json'], jsonLimit: '8mb'}));

    server.use(async ctx => {
      if (this.delay) {
        await sleep(this.delay);
      }

      if (this.errorRate) {
        const threshold = this.errorRate / 100;
        if (Math.random() < threshold) {
          throw new Error('A simulated error occurred while handling a request');
        }
      }

      if (ctx.method === 'GET') {
        print(formatBold('→ ') + formatBold(formatCode('introspect()', {addBackticks: false})));
        const result = layer.introspect();
        ctx.body = result;
        print(formatBold('← ') + formatValue(result, {multiline: false}));
      } else if (ctx.method === 'POST') {
        const {query, source} = ctx.request.body;
        print(
          formatBold('→ ') +
            formatBold(formatCode(`invoke(`, {addBackticks: false})) +
            formatValue({query, source}, {multiline: false}) +
            formatBold(formatCode(`)`, {addBackticks: false}))
        );
        const forkedLayer = layer.fork();
        const result = await forkedLayer.receiveQuery(query, {source});
        ctx.body = result;
        print(formatBold('← ') + formatValue(result, {multiline: false}));
      } else {
        throw new Error('Invalid HTTP request');
      }
    });

    return server;
  }
});
