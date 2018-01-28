import {isEmpty} from 'lodash';
import {
  printSuccess,
  formatValue,
  formatCode,
  formatBold,
  formatDanger,
  formatDim,
  formatPunctuation
} from '@resdir/console';
import RemoteResourceJSONRPCHandler from '@resdir/remote-resource-json-rpc-handler';
import Koa from 'koa';
import jsonError from 'koa-json-error';
import cors from '@koa/cors';
import body from 'koa-json-body';
// import createError from 'http-errors';

export default base =>
  class LocalServer extends base {
    createServer(environment) {
      const server = new Koa();

      server.use(jsonError(err => {
        const status = err.status || 500;
        const expose = err.expose !== undefined ? err.expose : status < 500;
        const name = expose ? err.name : 'InternalServerError';
        const message = expose ? err.message : 'The server encountered an error';
        const code = expose ? err.code : undefined;
        return {name, message, code, status};
      }));

      server.use(cors());

      server.use(body());

      server.use(async ctx => {
        const request = ctx.request.body;

        const jsonRPCHandler = await this.getJSONRPCHandler(environment);

        if (request.method === 'invoke') {
          const name = formatBold(formatCode(request.params.name, {addBackticks: false}));
          const input = formatValue(request.params.input, {multiline: false});
          const env = formatValue(request.params.environment, {multiline: false});
          const message =
            name +
            formatPunctuation('(') +
            input +
            formatPunctuation(', ') +
            env +
            formatPunctuation(') => ');
          process.stdout.write(message);
        }

        const startTime = Date.now();
        const response = await jsonRPCHandler.handleRequest(request);
        const elapsedTime = formatDim(`(${Date.now() - startTime}ms)`);

        if (request.method === 'invoke') {
          let message;
          if (response.error) {
            message = formatDanger('[ERROR] ') + response.error.message;
            if (!isEmpty(response.error.data)) {
              message += ' ' + formatValue(response.error.data, {multiline: false});
            }
          } else {
            const output = response.result && response.result.output;
            message = formatValue(output, {multiline: false});
          }
          message += ' ' + elapsedTime;
          console.log(message);
        }

        ctx.body = response;
      });

      return server;
    }

    async getJSONRPCHandler(environment) {
      const root = this.$getRoot();
      const resourceFile = root.$getResourceFile();
      const resource = await this.constructor.$import(resourceFile, {disableCache: true});
      const definition = root.getExportDefinition(environment);
      const jsonRPCHandler = new RemoteResourceJSONRPCHandler({
        resource,
        publicMethods: definition.methods
      });
      return jsonRPCHandler;
    }

    async start(_input, environment) {
      const server = this.createServer(environment);
      server.listen(this.port);
      printSuccess(`Local server started (port: ${this.port})`, environment);
    }
  };