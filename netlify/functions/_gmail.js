// netlify/functions/_gmail.js
const { supabase } = require('./_supabase');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Refresh an expired access token using the stored refresh token
async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to refresh access token: ${errText}`);
  }

  return res.json(); // { access_token, expires_in, ... }
}

// Get a valid access token for a user, refreshing if needed
async function getValidAccessToken(userId) {
  const { data: tokenRow, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenRow) {
    throw new Error('No Gmail tokens found for user');
  }

  const now = Date.now();
  const expiresAt = new Date(tokenRow.expires_at).getTime();

  if (expiresAt > now + 60000) {
    // Still valid for at least another minute
    return tokenRow.access_token;
  }

  // Expired or expiring soon — refresh it
  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  const newExpiresAt = new Date(now + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from('gmail_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}

// List recent messages in the inbox
async function listMessages(userId, maxResults = 10) {
  const accessToken = await getValidAccessToken(userId);

  const res = await fetch(
    `${GMAIL_API_BASE}/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Gmail list failed: ${await res.text()}`);
  return res.json();
}

// Get full content of a single message
async function getMessage(userId, messageId) {
  const accessToken = await getValidAccessToken(userId);

  const res = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Gmail get message failed: ${await res.text()}`);
  return res.json();
}

// Send a reply within an existing thread
async function sendReply(userId, { threadId, to, subject, body, inReplyTo }) {
  const accessToken = await getValidAccessToken(userId);

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    inReplyTo ? `References: ${inReplyTo}` : '',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].filter(Boolean).join('\r\n');

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage, threadId }),
  });

  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  return res.json();
}

module.exports = { getValidAccessToken, listMessages, getMessage, sendReply };
