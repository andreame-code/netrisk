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

if (typeof window !== 'undefined') {
  // Non stampare la key in chiaro
  // eslint-disable-next-line no-console
  console.info('[ENV]', {
    SUPABASE_URL,
    SUPABASE_KEY: SUPABASE_KEY ? '***present***' : '(empty)',
    WS_URL
  });
}
