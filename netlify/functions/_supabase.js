const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.REPLYMATE_DB_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing REPLYMATE_DB_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

module.exports = { getSupabase };
