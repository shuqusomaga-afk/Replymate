// netlify/functions/_session.js
const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'replymate_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

if (!SESSION_SECRET) {
  throw new Error('Missing SESSION_SECRET environment variable');
}

// Derive a fixed-length key from the secret
function getKey() {
  return crypto.createHash('sha256').update(SESSION_SECRET).digest();
}

// Encrypt a JS object into a signed, encrypted cookie value
function createSessionCookie(payload) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const value = `${iv.toString('base64')}.${encrypted.toString('base64')}`;

  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

// Parse the incoming Cookie header and decrypt the session, if present and valid
function getSession(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie;
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  try {
    const value = match.substring(COOKIE_NAME.length + 1);
    const [ivB64, dataB64] = value.split('.');
    if (!ivB64 || !dataB64) return null;

    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    // Invalid, tampered, or expired session cookie
    return null;
  }
}

// Build a cookie string that clears the session (used on logout)
function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

module.exports = { createSessionCookie, getSession, clearSessionCookie };
