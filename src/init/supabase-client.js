import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export { supabase };
export default supabase;
