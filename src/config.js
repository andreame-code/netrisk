export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';
export const WS_URL = (function(){
  if (SUPABASE_URL) {
    try {
      const u = new URL(SUPABASE_URL);
      return `wss://${u.host}/functions/v1/netrisk`;
    } catch {
      // invalid SUPABASE_URL
    }
  }
  console.error('[ENV] Missing SUPABASE_URL/ANON_KEY');
  return '';
})();

