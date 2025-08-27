// Importing the Supabase client fails when the dependency isn't installed.
// During unit tests we don't require the real client, so fall back to a no-op
// implementation if the module cannot be resolved.
let createClient;
try {
  // eslint-disable-next-line global-require
  ({ createClient } = require('@supabase/supabase-js'));
} catch {
  createClient = null;
}

const supabaseUrl = 'https://kdrfohrmfppyzzywhmsn.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase =
  createClient && typeof supabaseKey === 'string' && supabaseKey.length
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export { supabase };
export default supabase;
