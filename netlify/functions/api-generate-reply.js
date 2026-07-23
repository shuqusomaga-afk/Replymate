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

  const { emailBody, subject, from, tone } = payload;

  if (!emailBody) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'emailBody is required' }),
    };
  }

  const selectedTone = tone || 'professional';

  const prompt = `You are drafting a reply to the following email on behalf of the recipient.

From: ${from || 'unknown sender'}
Subject: ${subject || '(no subject)'}

Email content:
"""
${emailBody}
"""

Write a ${selectedTone} reply to this email. Keep it concise and natural — write only the reply body text, no subject line, no "Dear X" placeholder instructions, just the reply itself ready to send.`;

  try {
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

    if (!workerUrl) {
      throw new Error('Missing CLOUDFLARE_WORKER_URL environment variable');
    }

    const aiRes = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`AI worker request failed: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const replyText = aiData.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

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
      body: JSON.stringify({ reply: replyText }),
    };
  } catch (err) {
    console.error('api-generate-reply error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate reply' }),
    };
  }
};
