// Prefer Vite-provided variables but fall back to process.env so that
// server-side or test environments can inject the same values without
// relying on the bundler replacement.
const rawApiBaseUrl =
  import.meta.env?.VITE_API_BASE_URL ??
  (typeof process !== 'undefined' ? process.env.VITE_API_BASE_URL : '') ??
  '';

const rawSupabaseUrl =
  (typeof window !== 'undefined' && window.__env?.SUPABASE_URL) ??
  import.meta.env?.VITE_SUPABASE_URL ??
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : '') ??
  '';

const rawSupabaseKey =
  (typeof window !== 'undefined' && window.__env?.SUPABASE_ANON_KEY) ??
  import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : '') ??
  '';

export const API_BASE_URL = String(rawApiBaseUrl).replace(/\/+$/, '');
export const SUPABASE_URL = String(rawSupabaseUrl).replace(/\/+$/, '');
export const SUPABASE_KEY = String(rawSupabaseKey);

export const ENV_STAMP =
  (typeof window !== 'undefined' && window.__env?.STAMP) || '';
export const ENV_SHA =
  (typeof window !== 'undefined' && window.__env?.SHA) || '';
export const WS_URL = (() => {
  if (!SUPABASE_URL) return '';
  try {
    const u = new URL(SUPABASE_URL);
    return `wss://${u.host}/functions/v1/netrisk`;
  } catch {
    return '';
  }
})();
// Log diagnostico e banner se l'ambiente manca
if (typeof window !== 'undefined') {
  console.info('[ENV]', { STAMP: ENV_STAMP, SHA: ENV_SHA });
  if (!window.__env) {
    const banner = document.createElement('div');
    banner.textContent = 'Servizio temporaneamente non disponibile, riprova';
    banner.style.background = '#fcc';
    banner.style.color = '#000';
    banner.style.padding = '1em';
    banner.style.textAlign = 'center';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.zIndex = '9999';
    document.body?.prepend(banner);
  }
}

