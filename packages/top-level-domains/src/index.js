import {sortedIndexOf} from 'lodash';

import tlds from './data';

export function getTopLevelDomains() {
  return tlds;
}

export function isTopLevelDomain(tld) {
  return sortedIndexOf(tlds, tld) !== -1;
}

export default getTopLevelDomains;
