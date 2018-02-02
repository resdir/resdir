import Version, {validateVersion} from '@resdir/version';
import {task, formatString, formatCode} from '@resdir/console';

export default () => ({
  async validate({throwIfInvalid}) {
    return validateVersion(this.$value, {throwIfInvalid});
  },

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
      throw new Error(`${formatCode('version')} property is undefined`);
    }
    version = new Version(version);
    version.bump(part);
    this.$value = version.toString();
  }
});
