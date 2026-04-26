import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    // Use a unique storage key per app to avoid collisions with other Supabase apps on the same origin
    storageKey: 'aria-auth-token',
    // Prevent lock contention — use async lock with timeout
    lock: async (name, acquireTimeout, fn) => {
      return fn();
    },
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        cache: 'no-store',
      });
    },
  },
});

// Helper: check if we are rate limited
export function isRateLimitError(error) {
  if (!error) return false;
  return (
    error?.status === 429 ||
    error?.message?.toLowerCase().includes('rate limit') ||
    error?.message?.toLowerCase().includes('too many') ||
    error?.message?.toLowerCase().includes('email rate limit')
  );
}
