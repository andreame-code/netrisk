import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { info, error } from '../logger.js';

// Support both Node (tests/server) and browser environments.
// In the browser we expect the Supabase script to expose a global object.
let createClient;
if (typeof window === 'undefined' || !window.supabase) {
  // Node/test environment: load from installed package
  ({ createClient } = require('@supabase/supabase-js'));
} else {
  // Browser: use the global provided by the CDN script
  ({ createClient } = window.supabase);
}

// Initialize the client only when both URL and key are provided.
// This avoids hitting Supabase with empty credentials during development
// or when GitHub Actions secrets are not configured correctly.
export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
if (supabase) {
  info('[AUTH] client init ok');
} else {
  error('[AUTH] client init ko');
}

export function registerAuthListener(handler) {
  if (!supabase || typeof supabase.auth.onAuthStateChange !== 'function') {
    return;
  }
  supabase.auth.onAuthStateChange(handler);
}

export default supabase;
