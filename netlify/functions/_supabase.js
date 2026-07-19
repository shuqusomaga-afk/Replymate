// netlify/functions/_supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REPLYMATE_DB_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('DEBUG key length:', supabaseServiceKey ? supabaseServiceKey.length : 'MISSING');

try {
  const payload = JSON.parse(Buffer.from(supabaseServiceKey.split('.')[1], 'base64').toString());
  console.log('DEBUG key role:', payload.role);
} catch (e) {
  console.log('DEBUG decode error:', e.message);
}

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables (REPLYMATE_DB_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

// Service-role client — full access, server-side only. Never expose this key to the frontend.
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };
