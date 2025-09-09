const isDev =
  import.meta.env?.DEV ??
  (typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false);
const isProd =
  import.meta.env?.PROD ??
  (typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : false);

const rawApiBaseUrl =
  import.meta.env?.VITE_API_BASE_URL ??
  (typeof process !== 'undefined' ? process.env.VITE_API_BASE_URL : '') ??
  '';

const rawSupabaseUrl =
  import.meta.env?.VITE_SUPABASE_URL ??
  (typeof window !== 'undefined' && window.__env?.SUPABASE_URL) ??
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : '') ??
  '';

const rawSupabaseKey =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  (typeof window !== 'undefined' && window.__env?.SUPABASE_ANON_KEY) ??
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : '') ??
  '';

export const API_BASE_URL = String(rawApiBaseUrl).replace(/\/+$/, '');
export const SUPABASE_URL = String(rawSupabaseUrl).replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = String(rawSupabaseKey);
export const SUPABASE_KEY = SUPABASE_ANON_KEY;

export const ENV_STAMP = (typeof window !== 'undefined' && window.__env?.STAMP) || '';
export const ENV_SHA = (typeof window !== 'undefined' && window.__env?.SHA) || '';

export const WS_URL =
  import.meta.env?.VITE_WS_URL ??
  process.env.VITE_WS_URL ??
  (SUPABASE_URL
    ? (() => {
        try {
          const u = new URL(SUPABASE_URL);
          return `wss://${u.host}/functions/v1/netrisk`;
        } catch {
          return '';
        }
      })()
    : isDev
      ? 'ws://localhost:8081'
      : '');

export const FEATURES = {
  MULTIPLAYER: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
  WEBSOCKET: true,
  AI_SIMULATION: true,
  DEBUG_OVERLAY: isDev,
};

export const LOG_LEVEL =
  import.meta.env?.VITE_LOG_LEVEL ?? process.env.VITE_LOG_LEVEL ?? (isDev ? 'debug' : 'error');

export const GAME_CONFIG = {
  MAX_PLAYERS: 6,
  DEFAULT_TIMEOUT: 30000,
  HEARTBEAT_INTERVAL: 5000,
  RECONNECT_ATTEMPTS: 3,
};

const requiredEnvVars = {
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0 && isProd) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

if (missingVars.length > 0 && isDev) {
  console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('🔧 Multiplayer features will be disabled.');
  console.warn('💡 Create .env.local file with your Supabase credentials.');
}

export const config = {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    enabled: FEATURES.MULTIPLAYER,
  },
  websocket: {
    url: WS_URL,
    enabled: FEATURES.WEBSOCKET,
  },
  game: GAME_CONFIG,
  features: FEATURES,
  isDev,
  isProd,
  logLevel: LOG_LEVEL,
  apiBaseUrl: API_BASE_URL,
  envStamp: ENV_STAMP,
  envSha: ENV_SHA,
};

export default config;
