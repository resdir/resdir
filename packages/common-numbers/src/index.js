import httpStatusCodes from 'node-status-codes';

const COMMON_NUMBERS = [
  '0',
  '00',
  '000',
  '0000',
  '1',
  '01',
  '001',
  '0001',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '007',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '15',
  '20',
  '21',
  '22',
  '23',
  '24',
  '42',
  '99',
  '100',
  '101',
  '123',
  '1-2-3',
  '1000',
  '1001',
  '69',
  '300',
  '321',
  '3-2-1',
  '3-2-1-0',
  '365',
  '421',
  '666',
  '6-6-6',
  'pi',
  '3.14',
  '3-14',
  '314',
  '411',
  '4-1-1',
  '747',
  '911',
  '9-1-1',
  '570',
  '622',
  '632',
  '1066',
  '1280',
  '1492',
  '1649',
  '1660',
  '1668',
  '1776',
  '1789',
  '1861',
  '1900',
  '1914',
  '1917',
  '1918',
  '1933',
  '1936',
  '1939',
  '1945',
  '1960',
  '1968',
  '20',
  '30',
  '40',
  '50',
  '60',
  '68',
  '70',
  '80',
  '90'
];

export function isCommonNumber(number) {
  number = String(number);

  if (COMMON_NUMBERS.indexOf(number) !== -1) {
    return true;
  }

  number = Number(number);

  if (isNaN(number)) {
    return false;
  }

  if (number !== Math.round(number)) {
    // Not an integer
    return false;
  }

  if (httpStatusCodes[number]) {
    return true;
  }

  if (number >= 1970 && number <= 2050) {
    return true;
  }

  return false;
}
