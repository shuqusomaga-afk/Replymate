// netlify/functions/auth-logout.js
const { clearSessionCookie } = require('./_session');

exports.handler = async () => {
  const appUrl = process.env.APP_URL;

  return {
    statusCode: 302,
    headers: {
      Location: `${appUrl}/index.html`,
      'Set-Cookie': clearSessionCookie(),
    },
    body: '',
  };
};
