// netlify/functions/api-emails.js
const { getSession } = require('./_session');
const { listMessages, getMessage } = require('./_gmail');

// Pull plain-text body out of a Gmail message payload
function extractBody(payload) {
  if (!payload) return '';

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64').toString('utf8');
    }
    // Fall back to recursing into nested parts (e.g. multipart/alternative)
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

function getHeader(headers, name) {
  const header = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

exports.handler = async (event) => {
  const session = getSession(event);

  if (!session || !session.userId) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not authenticated' }),
    };
  }

  try {
    const maxResults = parseInt(event.queryStringParameters?.limit, 10) || 10;
    const listResult = await listMessages(session.userId, maxResults);
    const messageRefs = listResult.messages || [];

    // Fetch full content for each message
    const emails = await Promise.all(
      messageRefs.map(async (ref) => {
        const msg = await getMessage(session.userId, ref.id);
        const headers = msg.payload?.headers;

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          snippet: msg.snippet,
          body: extractBody(msg.payload),
          messageIdHeader: getHeader(headers, 'Message-ID'),
        };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    };
  } catch (err) {
    console.error('api-emails error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch emails' }),
    };
  }
};
