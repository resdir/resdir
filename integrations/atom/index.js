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
    // const resource = Resource.$load(directory, {
    //   searchInParentDirectories: true,
    //   throwIfNotFound: false
    // });
    // if (!resource) {
    //   return;
    // }
    // resource.$emitEvent('after:$fileModified', file).catch(err => {
    //   const message = `resdir: An error occurred while emitting 'after:$fileModified' event`;
    //   atom.notifications.addError(message, {detail: err.message, dismissable: true});
    // });

    const command = 'run';
    const args = ['$emitEvent', 'after:$fileModified', file];
    const options = {cwd: directory, timeout: 60 * 1000};
    execFile(command, args, options, (err, stdout, stderr) => {
      if (err) {
        const message = `resdir: An error occurred while emitting 'after:$fileModified' event`;
        atom.notifications.addError(message, {detail: stderr, dismissable: true});
      } else if (stdout) {
        console.log(stdout.trim());
      }
    });
  }
};
