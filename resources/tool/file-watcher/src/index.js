import {resolve} from 'path';
import minimatch from 'minimatch';

export default base =>
  class extends base {
    async _handleFileModifiedEvent({file}) {
      if (this.match(file)) {
        await this.onFileModified({file});
      }
    }

    match(file) {
      if (!this.files) {
        return true;
      }
      const directory = this.$getCurrentDirectory();
      const patterns = this.files.map(file => resolve(directory, file));
      for (const pattern of patterns) {
        if (minimatch(file, pattern)) {
          return true;
        }
      }
      return false;
    }
  };
