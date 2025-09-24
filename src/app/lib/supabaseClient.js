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

// Resolve the public site URL for redirects (supports LAN/tunnels during testing)
export function getPublicSiteUrl() {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || '';
}

const supabaseApi = { getSupabaseClient, hasSupabaseEnv, getPublicSiteUrl };
export default supabaseApi;
