// netlify/functions/auth-google.js
exports.handler = async (event) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId || !appUrl) {
    return {
      statusCode: 500,
      body: 'Missing GOOGLE_CLIENT_ID or APP_URL environment variable',
    };
  }

  const redirectUri = `${appUrl}/.netlify/functions/auth-callback`;

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',   // needed to get a refresh_token
    prompt: 'consent',        // forces refresh_token on every login
    include_granted_scopes: 'true',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
    },
    body: '',
  };
};
