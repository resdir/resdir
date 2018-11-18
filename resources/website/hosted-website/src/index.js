import {formatString, formatCode} from '@resdir/console';
import {createClientError} from '@resdir/error';

export default () => ({
  validate() {
    if (!this.domainName) {
      throw createClientError(`${formatCode('domainName')} attribute is missing`);
    }

    if (!this.contentDirectory) {
      throw createClientError(`${formatCode('contentDirectory')} attribute is missing`);
    }

    if (!this.indexPage) {
      throw createClientError(`${formatCode('indexPage')} attribute is missing`);
    }

    if (this.indexPage.startsWith('/') || this.indexPage.startsWith('.')) {
      throw createClientError(
        `${formatCode('indexPage')} can't start with ${formatString('/')} or ${formatString('.')}`
      );
    }

    for (const {errorCode, responseCode, responsePage} of this.customErrors || []) {
      if (!errorCode) {
        throw createClientError(
          `${formatCode('errorCode')} is missing in ${formatCode('customErrors')} attribute`
        );
      }

      if (responseCode && !responsePage) {
        throw createClientError(
          `${formatCode('responsePage')} is missing in ${formatCode('customErrors')} attribute`
        );
      }

      if (responsePage && (responsePage.startsWith('/') || responsePage.startsWith('.'))) {
        throw createClientError(
          `${formatCode('responsePage')} in ${formatCode(
            'customErrors'
          )} attribute can't start with ${formatString('/')} or ${formatString('.')}`
        );
      }
    }
  }
});
