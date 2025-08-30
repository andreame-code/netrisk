// Prefer Vite-provided variables but fall back to process.env so that
// server-side or test environments can inject the same values without
// relying on the bundler replacement.
const rawApiBaseUrl =
  import.meta.env?.VITE_API_BASE_URL ??
  (typeof process !== 'undefined' ? process.env.VITE_API_BASE_URL : '') ??
  '';
const rawSupabaseUrl =
  import.meta.env?.VITE_SUPABASE_URL ??
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : '') ??
  '';
export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
export const SUPABASE_URL = rawSupabaseUrl.replace(/\/+$/, '');
export const SUPABASE_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  (typeof process !== 'undefined'
    ? process.env.VITE_SUPABASE_ANON_KEY
    : '') ??
  '';
export const WS_URL = (() => {
  if (!SUPABASE_URL) return '';
  try {
    const u = new URL(SUPABASE_URL);
    return `wss://${u.host}/functions/v1/netrisk`;
  } catch {
    return '';
  }
})();
// Log diagnostico (mascherato)
if (typeof window !== 'undefined') {
  console.info('[ENV]', {
    API_BASE_URL,
    SUPABASE_URL,
    SUPABASE_KEY: SUPABASE_KEY ? '***present***' : '(empty)',
    WS_URL,
  });
}

