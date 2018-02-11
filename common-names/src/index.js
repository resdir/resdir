import bigCompanies from 'big-companies';
import {isCommonEnglishWord} from '@resdir/common-english-words';
import {isCommonTag} from '@resdir/common-tags';
import {isTopLevelDomain} from '@resdir/top-level-domains';
import {isCommonNumber} from '@resdir/common-numbers';
import {isCommonFileExtension} from '@resdir/common-file-extensions';
import {createClientError} from '@resdir/error';

export default () => ({
  ping(_input, _environment) {
    return 'pong';
  },

  async isCommonName({name}, _environment) {
    if (!name) {
      throw createClientError('\'name\' argument is missing');
    }

    const bigCompany = bigCompanies.find(company => company.shortNames.includes(name));
    if (bigCompany) {
      return {isCommonName: true, reason: 'BIG_COMPANY', info: {company: bigCompany.name}};
    }

    if (isCommonNumber(name)) {
      return {isCommonName: true, reason: 'COMMON_NUMBER'};
    }

    if (isTopLevelDomain(name)) {
      return {isCommonName: true, reason: 'TOP_LEVEL_DOMAIN'};
    }

    if (isCommonFileExtension(name)) {
      return {isCommonName: true, reason: 'COMMON_FILE_EXTENSION'};
    }

    if (isCommonEnglishWord(name)) {
      return {isCommonName: true, reason: 'COMMON_ENGLISH_WORD'};
    }

    if (isCommonTag(name)) {
      return {isCommonName: true, reason: 'COMMON_TAG'};
    }

    return {isCommonName: false};
  }
});
