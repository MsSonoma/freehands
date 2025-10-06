import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getSupabaseAdmin(){
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !svc) return null
    return createClient(url, svc, { auth: { persistSession: false } })
  } catch {
    return null
  }
}

export async function GET(){
  const checks = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    openaiKey: !!process.env.OPENAI_API_KEY,
  }

  try {
    const supabase = await getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ 
        ...checks,
        error: 'Could not create Supabase client',
        success: false
      })
    }

    // Try to list buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      return NextResponse.json({
        ...checks,
        error: `Buckets list error: ${bucketsError.message}`,
        bucketsError: bucketsError,
        success: false
      })
    }

    const lessonsBucket = buckets?.find(b => b.name === 'lessons')
    
    if (!lessonsBucket) {
      return NextResponse.json({
        ...checks,
        error: 'lessons bucket does not exist',
        availableBuckets: buckets?.map(b => b.name),
        success: false
      })
    }

    // Try to list files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from('lessons')
      .list('facilitator-lessons', { limit: 5 })

    return NextResponse.json({
      ...checks,
      bucketExists: true,
      bucketDetails: lessonsBucket,
      canListFiles: !listError,
      listError: listError ? listError.message : null,
      sampleFiles: files?.slice(0, 5),
      success: true
    })
  } catch (e) {
    return NextResponse.json({
      ...checks,
      error: e.message || String(e),
      success: false
    }, { status: 500 })
  }
}
