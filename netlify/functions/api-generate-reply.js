// netlify/functions/api-generate-reply.js
const { getSession } = require('./_session');
const { supabase } = require('./_supabase');

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
  }

  // Paywall check — block free users from generating replies
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

  const { emailBody, subject, from, tone } = payload;

  if (!emailBody) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'emailBody is required' }),
    };
  }

  const selectedTone = tone || 'professional';

  // Build a single combined email string — the Worker expects one
  // emailContent field, not separate from/subject/body fields.
  const emailContent = `From: ${from || 'unknown sender'}
Subject: ${subject || '(no subject)'}

${emailBody}`;

  try {
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

    if (!workerUrl) {
      throw new Error('Missing CLOUDFLARE_WORKER_URL environment variable');
    }

    const aiRes = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailContent: emailContent,
        tone: selectedTone,
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      throw new Error(`AI worker request failed (${aiRes.status}): ${errBody}`);
    }

    const aiData = await aiRes.json();
    const replyText = aiData.reply?.trim();

    if (!replyText) {
      throw new Error('AI response contained no text content');
    }

    // Log this generation to email_replies for history
    await supabase.from('email_replies').insert({
      user_id: session.userId,
      original_email: emailBody,
      generated_reply: replyText,
      status: 'drafted',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: replyText, modelUsed: aiData.modelUsed, provider: aiData.provider }),
    };
  } catch (err) {
    console.error('api-generate-reply error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      // Include the real error message so it's visible in Netlify logs
      // and can be surfaced in the UI if needed for debugging.
      body: JSON.stringify({ error: 'Failed to generate reply', details: err.message }),
    };
  }
};
