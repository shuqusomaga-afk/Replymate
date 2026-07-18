// netlify/functions/auth-callback.js
const { supabase } = require('./_supabase');
const { createSessionCookie } = require('./_session');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

exports.handler = async (event) => {
  const { code, error: oauthError } = event.queryStringParameters || {};
  const appUrl = process.env.APP_URL;

  if (oauthError) {
    return {
      statusCode: 302,
      headers: { Location: `${appUrl}/index.html?error=access_denied` },
      body: '',
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      body: 'Missing authorization code',
    };
  }

  try {
    const redirectUri = `${appUrl}/.netlify/functions/auth-callback`;

    // Exchange the code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    }

    const tokens = await tokenRes.json();
    // tokens: { access_token, refresh_token, expires_in, id_token, scope, token_type }

    if (!tokens.refresh_token) {
      // Happens if the user already granted consent before and Google skips issuing a new refresh_token.
      // prompt: 'consent' on auth-google.js should prevent this, but guard anyway.
      console.warn('No refresh_token returned — user may need to revoke app access and reconnect');
    }

    // Get the user's email/profile
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new Error(`Fetching user info failed: ${await userInfoRes.text()}`);
    }

    const userInfo = await userInfoRes.json();
    // userInfo: { id, email, name, picture, ... }

    // Upsert the user row
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .upsert(
        {
          google_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          avatar_url: userInfo.picture,
        },
        { onConflict: 'google_id' }
      )
      .select()
      .single();

    if (userError) throw new Error(`User upsert failed: ${userError.message}`);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert the Gmail token row
    const tokenUpdate = {
      user_id: userRow.id,
      access_token: tokens.access_token,
      expires_at: expiresAt,
      scope: tokens.scope,
    };
    // Only overwrite refresh_token if we actually got one this time
    if (tokens.refresh_token) {
      tokenUpdate.refresh_token = tokens.refresh_token;
    }

    const { error: tokenError } = await supabase
      .from('gmail_tokens')
      .upsert(tokenUpdate, { onConflict: 'user_id' });

    if (tokenError) throw new Error(`Token upsert failed: ${tokenError.message}`);

    // Set the session cookie and redirect into the app
    const cookie = createSessionCookie({ userId: userRow.id });

    return {
      statusCode: 302,
      headers: {
        Location: `${appUrl}/app.html`,
        'Set-Cookie': cookie,
      },
      body: '',
    };
  } catch (err) {
    console.error('auth-callback error:', err);
    return {
      statusCode: 302,
      headers: { Location: `${appUrl}/index.html?error=auth_failed` },
      body: '',
    };
  }
};
