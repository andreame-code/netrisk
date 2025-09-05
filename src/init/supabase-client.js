import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { info, warn } from '../logger.js';

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
export const supabase = (() => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    warn('[Supabase] ENV missing — multiplayer/lobby disabilitati');
    return null;
  }
  if (typeof window !== 'undefined') {
    const tokenKey = 'supabase.auth.token';
    const sessionToken = window.sessionStorage.getItem(tokenKey);
    const localToken = window.localStorage.getItem(tokenKey);
    const storage = sessionToken && !localToken ? window.sessionStorage : window.localStorage;
    return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage } });
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
})();
if (supabase) {
  info('[AUTH] client init ok');
}

export function registerAuthListener(handler) {
  if (!supabase || typeof supabase.auth.onAuthStateChange !== 'function') {
    return;
  }
  supabase.auth.onAuthStateChange(handler);
}

export default supabase;
