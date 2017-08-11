import generate from 'nanoid/generate';

const DIGITS = '0123456789';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
export const CHARACTERS = DIGITS + LETTERS + LETTERS.toUpperCase();

export function generateSecret(length = 32) {
  return generate(CHARACTERS, length);
}

export default generateSecret;
