import Version from '@resdir/version';
import {task, formatString, formatCode} from '@resdir/console';
import {createClientError} from '@resdir/error';

export default () => ({
  async bump({major, minor, patch}, environment) {
    let part;
    if (major) {
      part = 'major';
    } else if (minor) {
      part = 'minor';
    } else if (patch) {
      part = 'patch';
    } else {
      part = 'patch';
    }

    await task(
      async progress => {
        this._bump(part);
        await this.$getRoot().$save();
        progress.setOutro(`Version number bumped to ${formatString(this.$value)}`);
      },
      {intro: 'Bumping version number...'},
      environment
    );
  },

  _bump(part) {
    let version = this.$value;
    if (!version) {
      throw createClientError(`${formatCode('version')} attribute is undefined`);
    }
    version = new Version(version);
    version.bump(part);
    this.$value = version.toString();
  }
});
