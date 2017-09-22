import {sortedIndexOf} from 'lodash';

import words from '../data';

export function getCommonEnglishWords() {
  return words;
}

export function isCommonEnglishWord(word) {
  return sortedIndexOf(words, word) !== -1;
}

export default getCommonEnglishWords;
