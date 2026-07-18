// netlify/functions/api-me.js
const { supabase } = require('./_supabase');
const { getSession } = require('./_session');

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
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, created_at')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    };
  } catch (err) {
    console.error('api-me error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
