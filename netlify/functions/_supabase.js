// netlify/functions/_supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REPLYMATE_DB_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
