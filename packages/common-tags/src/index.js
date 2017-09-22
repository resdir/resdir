import {sortedIndexOf} from 'lodash';

import tags from '../data';

export function getCommonTags() {
  return tags;
}

export function isCommonTag(tag) {
  return sortedIndexOf(tags, tag) !== -1;
}

export default getCommonTags;
