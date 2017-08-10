import crypto from 'crypto';

const digits = '0123456789';
const letters = 'abcdefghijklmnopqrstuvwxyz';
const characters = digits + letters + letters.toUpperCase();

export function generateSecret(length = 32) {
  let secret = '';
  const bytes = crypto.randomBytes(length);
  for (const byte of bytes) {
    secret += characters[byte % characters.length];
  }
  return secret;
}

export default generateSecret;
