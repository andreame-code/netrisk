import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { info, error } from '../logger.js';

// Initialize the client only when both URL and key are provided.
// This avoids hitting Supabase with empty credentials during development
// or when GitHub Actions secrets are not configured correctly.
export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let authListenerRegistered = false;

if (supabase) {
  info('Supabase client initialized');
  if (!authListenerRegistered) {
    authListenerRegistered = true;
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const { renderUserMenu } = await import('../auth.js');
        await renderUserMenu();
      }
    });
  }
} else {
  error('Supabase client not initialized: missing URL or anon key');
}

export default supabase;
