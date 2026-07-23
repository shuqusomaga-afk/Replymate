// netlify/functions/api-send-reply.js
const { getSession } = require('./_session');
const { supabase } = require('./_supabase');
const { sendReply } = require('./_gmail');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const session = getSession(event);

  if (!session || !session.userId) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not authenticated' }),
    };
  }// Paywall check — block free users from generating replies
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('plan_status')
    .eq('id', session.userId)
    .single();

  if (userErr || !userRow || userRow.plan_status !== 'paid') {
    return {
      statusCode: 402,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upgrade required', upgradeRequired: true }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { threadId, to, subject, replyBody, inReplyTo, replyLogId } = payload;

  if (!threadId || !to || !replyBody) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'threadId, to, and replyBody are required' }),
    };
  }

  try {
    const result = await sendReply(session.userId, {
      threadId,
      to,
      subject: subject || '',
      body: replyBody,
      inReplyTo,
    });

    // Update the matching draft log row to "sent", if we know which one it was
    if (replyLogId) {
      await supabase
        .from('email_replies')
        .update({ status: 'sent' })
        .eq('id', replyLogId)
        .eq('user_id', session.userId);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: result.id }),
    };
  } catch (err) {
    console.error('api-send-reply error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to send reply' }),
    };
  }
};
