'use babel';

/* global atom */

import {dirname} from 'path';
import {execFile} from 'child_process';
import {CompositeDisposable} from 'atom';
// Disabled until we can use Node 8 in Atom:
// import {Resource} from 'run-core';

export default {
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.workspace.observeTextEditors(textEditor => {
        this.subscriptions.add(textEditor.onDidSave(this.handleDidSave.bind(this)));
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  handleDidSave(event) {
    const file = event.path;
    const directory = dirname(file);

    // Disabled until we can use Node 8 in Atom:
    // Resource.$load(directory, {
    //   searchInParentDirectories: true,
    //   throwIfNotFound: false
    // }).then(resource => {
    //   if (resource) {
    //     resource.$emitEvent('@fileModified', {file, quiet: true}).catch(err => {
    //       const message = `resdir: An error occurred while emitting '@fileModified' event`;
    //       atom.notifications.addError(message, {detail: err.message, dismissable: true});
    //     });
    //   }
    // });

    const command = 'run'; // /Users/mvila/Projects/run/cli/dist/bin/index.js
    const args = [
      '@broadcast',
      '--event=@fileModified',
      `--arguments=${JSON.stringify({file}).replace(/"/g, '\\"')}`
    ];
    const options = {cwd: directory, timeout: 60 * 1000};
    execFile(command, args, options, (err, stdout, stderr) => {
      if (stdout) {
        console.log(stdout.trim());
      }
      if (err) {
        const message = `resdir: An error occurred while emitting '@fileModified' event`;
        atom.notifications.addError(message, {detail: stderr, dismissable: true});
      }
    });
  }
};
