const ENV = (typeof window!=='undefined' && window.__ENV) ? window.__ENV : {};
export const SUPABASE_URL = ENV.SUPABASE_URL || '';
export const SUPABASE_KEY = ENV.SUPABASE_ANON_KEY || '';
export const WS_URL = (function(){
  if (ENV.WS_URL) return ENV.WS_URL;
  if (SUPABASE_URL) {
    try {
      const u = new URL(SUPABASE_URL);
      return `wss://${u.host}/functions/v1/netrisk`;
    } catch {
      // invalid SUPABASE_URL
    }
  }
  console.error('[ENV] Missing SUPABASE_URL/ANON_KEY in env.js');
  return '';
})();

