export const SUPABASE_URL = (import.meta.env?.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const WS_URL = (() => {
  if (!SUPABASE_URL) return '';
  try {
    const u = new URL(SUPABASE_URL);
    return `wss://${u.host}/functions/v1/netrisk`;
  } catch {
    return '';
  }
})();
