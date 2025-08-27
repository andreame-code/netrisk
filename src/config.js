export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const WS_URL = (function(){
  if (SUPABASE_URL) {
    try {
      const u = new URL(SUPABASE_URL.replace(/\/+$/, ''));
      return `wss://${u.host}/functions/v1/netrisk`;
    } catch { return ''; }
  }
  return '';
})();
