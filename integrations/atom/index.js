'use babel';

/* global atom */

import {dirname} from 'path';
import {CompositeDisposable} from 'atom';
import {Resource} from 'run-core';

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
    const resource = Resource.$load(directory, {
      searchInParentDirectories: true,
      throwIfNotFound: false
    });
    if (!resource) {
      return;
    }
    resource.$emitEvent('after:$fileModified', file).catch(err => {
      const message = `resdir: An error occurred while emitting 'after:$fileModified' event`;
      atom.notifications.addError(message, {detail: err.message, dismissable: true});
    });
  }
};
