'use babel';

/* global atom */

import 'regenerator-runtime/runtime';
import {dirname} from 'path';
import {execFile} from 'child_process';
import {CompositeDisposable} from 'atom';
// import {Resource} from 'run-core';

export default {
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.workspace.observeTextEditors(textEditor => {
      this.subscriptions.add(textEditor.onDidSave(this.handleDidSave.bind(this)));
    }));
  },

  consumeSignal(registry) {
    this.signalProvider = registry.create();
    this.subscriptions.add(this.signalProvider);
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  async handleDidSave(event) {
    this.signalProvider.add(`Resdir integration 'handleDidSave'`);

    try {
      await this.broadcastFileModifiedEvent(event.path);
    } catch (err) {
      const message = `resdir: An error occurred while broadcasting '@fileModified' event`;
      atom.notifications.addError(message, {detail: err.message, dismissable: true});
    }

    this.signalProvider.clear();
  },

  // async broadcastFileModifiedEvent(file) {
  //   const directory = dirname(file);
  //
  //   const resource = await Resource.$load(directory, {
  //     searchInParentDirectories: true,
  //     throwIfNotFound: false
  //   });
  //
  //   if (resource) {
  //     await resource.$broadcast('@fileModified', {file, '@quiet': true});
  //   }
  // }

  broadcastFileModifiedEvent(file) {
    const directory = dirname(file);

    return new Promise((resolve, reject) => {
      const command = 'run'; // /Users/mvila/Projects/run/cli/dist/bin/index.js
      const args = ['@broadcast', '--event=@fileModified', `--file=${file}`, '--@quiet'];
      const options = {cwd: directory, timeout: 60 * 1000};
      execFile(command, args, options, (err, stdout, stderr) => {
        if (stdout) {
          console.log(stdout.trim());
        }
        if (err) {
          reject(new Error(stderr));
        } else {
          resolve();
        }
      });
    });
  }
};
