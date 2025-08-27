const ENV = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};
export const SUPABASE_URL = ENV.SUPABASE_URL || '';
export const SUPABASE_KEY = ENV.SUPABASE_ANON_KEY || '';
export const WS_URL = (function(){
  if (ENV.WS_URL) return ENV.WS_URL;
  try {
    const u = new URL(SUPABASE_URL);
    const wss = `wss://${u.host}/functions/v1/netrisk`;
    return (location.protocol === 'https:' ? wss : (location.hostname==='localhost' ? 'ws://localhost:8081' : wss));
  } catch { return ''; }
})();
