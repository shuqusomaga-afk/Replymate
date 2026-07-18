const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'replymate_session';
const SEVEN_DAYS = 60 * 60 * 24 * 7;

function createSessionCookie(userId, email) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing SESSION_SECRET environment variable');

  const token = jwt.sign({ userId, email }, secret, { expiresIn: SEVEN_DAYS });

  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SEVEN_DAYS}`;
}

function readSession(event) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing SESSION_SECRET environment variable');

  const cookieHeader = event.headers.cookie || event.headers.Cookie || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  const token = match.split('=')[1];
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

module.exports = { createSessionCookie, readSession, clearSessionCookie };
