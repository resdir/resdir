import {isEmpty} from 'lodash';
import {
  print,
  printSuccess,
  formatValue,
  formatCode,
  formatBold,
  formatDanger,
  formatDim,
  formatPunctuation,
  formatURL
} from '@resdir/console';
import RemoteResourceJSONRPCHandler from '@resdir/remote-resource-json-rpc-handler';
import {isClientError, isServerError} from '@resdir/error';
import Koa from 'koa';
import jsonError from 'koa-json-error';
import cors from '@koa/cors';
import body from 'koa-json-body';
import notifier from 'node-notifier';
import sleep from 'sleep-promise';

const CACHE_RESOURCE = true;

export default Resource => ({
  createServer(environment) {
    const server = new Koa();

    server.use(
      jsonError(err => {
        const status = isClientError(err) ? 400 : 500;
        const expose = isClientError(err) || isServerError(err);
        const name = expose ? err.name : 'InternalServerError';
        const message = expose ? err.message : 'The server encountered an error';
        const code = expose ? err.code : undefined;
        return {name, message, code, status};
      })
    );

    server.use(cors({maxAge: 300})); // 5 minutes

    server.use(body());

    server.use(async ctx => {
      const request = ctx.request.body || {};

      if (this.delay) {
        await sleep(this.delay);
      }

      const jsonRPCHandler = await this.getJSONRPCHandler(environment);

      if (request.method === 'getMethods') {
        const message =
          formatBold('→ ') + formatBold(formatCode('<getMethods>', {addBackticks: false}));
        print(message);
      } else if (request.method === 'invoke') {
        const name = formatBold(formatCode(request.params.name, {addBackticks: false}));
        const input = formatValue(request.params.input, {multiline: false});
        const env = formatValue(request.params.environment, {multiline: false});
        const message =
          formatBold('→ ') +
          name +
          formatPunctuation('(') +
          input +
          formatPunctuation(', ') +
          env +
          formatPunctuation(')');
        print(message);
      }

      const startTime = Date.now();
      const response = await jsonRPCHandler.handleRequest(request);
      const elapsedTime = formatDim(`(${Date.now() - startTime}ms)`);

      let message = formatBold('← ');
      if (response.error) {
        message += formatDanger('[ERROR] ') + response.error.message;
        if (!isEmpty(response.error.data)) {
          message += ' ' + formatValue(response.error.data, {multiline: false});
        }
      } else if (request.method === 'getMethods') {
        message += formatValue(response.result, {multiline: false});
      } else if (request.method === 'invoke') {
        const output = response.result && response.result.output;
        message += formatValue(output, {multiline: false});
      }
      message += ' ' + elapsedTime;
      print(message.trim());

      ctx.body = response;
    });

    return server;
  },

  async getJSONRPCHandler(environment) {
    if (!CACHE_RESOURCE || !this._jsonRPCHandler) {
      const root = this.$getRoot();
      const resourceFile = root.$getResourceFile();
      const resource = await Resource.$import(resourceFile, {disableCache: true});
      const definition = root.getExportDefinition(environment);
      this._jsonRPCHandler = new RemoteResourceJSONRPCHandler({
        resource,
        publicMethods: definition.methods
      });
    }
    return this._jsonRPCHandler;
  },

  async start({notify}, environment) {
    if (CACHE_RESOURCE) {
      process.env.RESOURCE_IS_CACHED = '1'; // TODO: Remove this ugliness
    }
    const server = this.createServer(environment);
    server.listen(this.port);
    printSuccess(
      `Test server started ${formatPunctuation(`(`)}${formatURL(
        `http://localhost:${this.port}`
      )}${formatPunctuation(`)`)}`,
      environment
    );
    if (notify) {
      notifier.notify({title: 'Test server started', message: `http://localhost:${this.port}`});
    }
  }
});
