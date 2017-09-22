import {isCommonNumber} from './';

console.log(`123: ${isCommonNumber(123)}`);
console.log(`007: ${isCommonNumber('007')}`);
console.log(`1789: ${isCommonNumber('1789')}`);
console.log(`3.14: ${isCommonNumber('3.14')}`);
console.log(`911: ${isCommonNumber('911')}`);
console.log(`9-1-1: ${isCommonNumber('9-1-1')}`);
console.log(`404: ${isCommonNumber('404')}`);
console.log(`2017: ${isCommonNumber('2017')}`);
console.log(`2050: ${isCommonNumber('2050')}`);
console.log(`2051: ${isCommonNumber('2051')}`);
console.log(`2017.1: ${isCommonNumber('2017.1')}`);
