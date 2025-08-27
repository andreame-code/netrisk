import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdrfohrmfppyzzywhmsn.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase =
  typeof supabaseKey === 'string' && supabaseKey.length
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export { supabase };
export default supabase;
