import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/facilitator';

  if (code) {
    // Create server-side Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          detectSessionInUrl: true,
          persistSession: false
        }
      }
    );
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      
      // Mark facilitator section as active to skip PIN on redirect
      const response = NextResponse.redirect(new URL(next, requestUrl.origin));
      return response;
    } catch (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(new URL('/auth/login?error=auth_callback_failed', requestUrl.origin));
    }
  }

  // No code provided - redirect to login
  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin));
}
