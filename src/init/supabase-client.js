import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

// Initialize the client only when both URL and key are provided.
// This avoids hitting Supabase with empty credentials during development
// or when GitHub Actions secrets are not configured correctly.
export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (!supabase) {
  // eslint-disable-next-line no-console
  console.warn('Supabase client not initialized: missing URL or anon key');
}

export default supabase;
