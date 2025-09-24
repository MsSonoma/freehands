import { createClient } from '@supabase/supabase-js';

let browserClient = null;

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseClient() {
  if (!hasSupabaseEnv()) return null;
  if (browserClient) return browserClient;
  // Create a singleton client in the browser that persists session and auto-refreshes tokens
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
  return browserClient;
}

const supabaseApi = { getSupabaseClient, hasSupabaseEnv };
export default supabaseApi;
