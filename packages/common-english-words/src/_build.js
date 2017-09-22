import {readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {union} from 'lodash';

function read(file) {
  return readFileSync(join(__dirname, '..', 'data', file), 'utf8');
}

function parse(data) {
  const lines = data.split('\n');
  return lines;
}

function clean(input) {
  const output = [];
  for (let entry of input) {
    entry = entry.toLowerCase();
    entry = entry.replace(/[^a-z0-9]/g, ' ');
    const words = entry.split(' ');
    for (const word of words) {
      if (word) {
        if (!output.includes(word)) {
          output.push(word);
        }
      }
    }
  }
  return output;
}

let allWords = [];

const files = [
  'education-first-top-3000-words.txt', // http://www.ef.edu/english-resources/english-vocabulary/top-3000-words/
  'google-10000-english-usa.txt', // https://github.com/first20hours/google-10000-english
  'google-10000-english.txt', // https://github.com/first20hours/google-10000-english
  'oxford-3000-words.txt' // https://github.com/OliverCollins/Oxford-3000-Word-List
];

for (const file of files) {
  let words = parse(read(file));
  words = clean(words);
  allWords = union(allWords, words);
}

allWords.sort();

const js = 'module.exports = ' + JSON.stringify(allWords) + ';';
writeFileSync(join(__dirname, '..', 'data.js'), js);

console.log(`${allWords.length} words written in data.js`);
