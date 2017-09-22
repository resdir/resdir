import mimeTypes from 'mime-db';

let allExtensions;

export function getCommonFileExtensions() {
  if (!allExtensions) {
    allExtensions = [];
    for (const key of Object.keys(mimeTypes)) {
      const extensions = mimeTypes[key].extensions || [];
      for (const extension of extensions) {
        if (!allExtensions.includes(extension)) {
          allExtensions.push(extension);
        }
      }
    }
  }
  return allExtensions;
}

export function isCommonFileExtension(extension) {
  return getCommonFileExtensions().includes(extension);
}

export default getCommonFileExtensions;
