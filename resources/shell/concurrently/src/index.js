import concurrently from 'concurrently';
import {createClientError} from '@resdir/error';

export default () => ({
  async run() {
    try {
      const commands = this.commands.map(command => {
        if (process.pkg && command.startsWith('run ')) {
          // Solve an issue when Run is packaged with 'pkg'
          // (see https://github.com/zeit/pkg/issues/591)
          command = 'run ' + process.pkg.entrypoint + ' ' + command.slice(4);
        }
        return command;
      });

      await concurrently(commands, {killOthers: ['failure']});
    } catch (err) {
      throw createClientError('An error occurred while running a command');
    }
  }
});
