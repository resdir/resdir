import {isTopLevelDomain} from './';

console.log(`fr: ${isTopLevelDomain('fr')}`);
console.log(`xyz: ${isTopLevelDomain('xyz')}`);
console.log(`resource: ${isTopLevelDomain('resource')}`);
