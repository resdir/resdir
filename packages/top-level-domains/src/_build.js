import {readFileSync, writeFileSync} from 'fs';
import {join} from 'path';

function read(file) {
  return readFileSync(join(__dirname, '..', '..', 'data', file), 'utf8');
}

function parse(data) {
  let lines = data.split('\n');
  lines = lines.filter(line => line && !line.startsWith('#'));
  return lines;
}

function clean(input) {
  const output = [];
  for (let entry of input) {
    if (entry.includes('--')) {
      continue; // Ignore non-ASCII TLD (example: 'XN--11B4C3D')
    }
    entry = entry.toLowerCase();
    output.push(entry);
  }
  return output;
}

const tlds = clean(parse(read('tlds-alpha-by-domain.txt'))); // http://data.iana.org/TLD/tlds-alpha-by-domain.txt

tlds.sort();

const js = 'export default ' + JSON.stringify(tlds) + ';';
writeFileSync(join(__dirname, '..', '..', 'src', 'data.js'), js);

console.log(`${tlds.length} TLDs written in data.js`);
