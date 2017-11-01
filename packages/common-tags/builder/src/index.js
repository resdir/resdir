import {readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {promisify} from 'util';
import assert from 'assert';
import {sortBy, union, uniq, trim as trimString} from 'lodash';
import {parseString as parseXML} from 'xml2js';

const parseXMLAsync = promisify(parseXML);

const TRIM_RATIO = 2 / 3; // Only keep 33% of the most popular tags

export default base =>
  class extends base {
    async build() {
      function read(file) {
        return readFileSync(join(__dirname, '..', '..', 'data', 'stack-exchange', file), 'utf8');
      }

      async function parse(data) {
        data = await parseXMLAsync(data);
        data = data.tags.row.map(item => ({name: item.$.TagName, count: Number(item.$.Count)}));
        data = sortBy(data, 'count');
        data.reverse();
        data = data.map(item => item.name);
        return data;
      }

      function trim(data) {
        return data.slice(0, Math.round(-data.length * TRIM_RATIO));
      }

      function clean(tags) {
        const newTags = [];

        function handleDotsAndDashes(tag) {
          let newTag = tag.replace(/\./g, '-');
          newTag = trimDashes(newTag);
          if (newTag !== tag) {
            newTags.push(newTag);
            handleDashes(newTag);
          }
          handleDashes(tag);
        }

        function handleDashes(tag) {
          const newTag = tag.replace(/-/g, '');
          if (newTag !== tag) {
            newTags.push(newTag);
          }
        }

        function trimDashes(tag) {
          tag = trimString(tag, '-');
          tag = tag.replace(/-+/g, '-');
          return tag;
        }

        for (let tag of tags) {
          if (tag.endsWith('js') && tag.substr(-3, 1).match(/[a-z0-9]/)) {
            // 'nodejs' => 'node.js' (later producing 'node-js', 'nodejs', etc.)
            tag = tag.slice(0, -2) + '.js';
          }
          const matches = tag.match(/[^a-z0-9-#+.]/);
          if (matches) {
            throw new Error(`Invalid character found in tag '${tag}'`);
          }
          tag = trimDashes(tag);
          newTags.push(tag);
          handleDotsAndDashes(tag);
          let newTag = tag.replace(/#/g, '-sharp-');
          newTag = newTag.replace(/\+/g, '-plus-');
          newTag = newTag.replace(/\./g, '-dot-');
          newTag = trimDashes(newTag);
          if (newTag !== tag) {
            newTags.push(newTag);
            handleDotsAndDashes(newTag);
          }
        }

        return newTags;
      }

      let allTags = [];

      const files = [
        // Source: https://archive.org/download/stackexchange
        'android-tags.xml',
        'apple-tags.xml',
        'askubuntu-tags.xml',
        'cs-tags.xml',
        'dba-tags.xml',
        'gamedev-tags.xml',
        'gaming-tags.xml',
        'graphicdesign-tags.xml',
        'meta-stackexchange-tags.xml',
        'meta-stackoverflow-tags.xml',
        'movies-tags.xml',
        'networkengineering-tags.xml',
        'opendata-tags.xml',
        'photo-tags.xml',
        'rpg-tags.xml',
        'scifi-tags.xml',
        'security-tags.xml',
        'serverfault-tags.xml',
        'softwareengineering-tags.xml',
        'softwarerecs-tags.xml',
        'stackoverflow-tags.xml',
        'superuser-tags.xml',
        'travel-tags.xml',
        'unix-tags.xml',
        'ux-tags.xml',
        'webapps-tags.xml',
        'webmasters-tags.xml'
      ];

      for (const file of files) {
        const tags = clean(trim(await parse(read(file))));
        console.log(`${file}: ${tags.length} tags`);
        allTags = union(allTags, tags);
      }

      allTags.sort();

      assert(uniq(allTags).length === allTags.length, 'No duplicate tags');

      const js = 'module.exports = ' + JSON.stringify(allTags) + ';';
      writeFileSync(join(__dirname, '..', '..', 'data.js'), js);

      console.log(`${allTags.length} tags written in data.js`);
    }
  };
