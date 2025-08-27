const ENV = typeof window !== 'undefined' ? window.__ENV || {} : {};
export const SUPABASE_URL = ENV.SUPABASE_URL || '';
export const SUPABASE_KEY = ENV.SUPABASE_ANON_KEY || '';
export const WS_URL = ENV.WS_URL || '';
export const IS_TEST = typeof jest !== 'undefined';
