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

export async function GET(request){
  try {
    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    
    // First, list all user folders in facilitator-lessons
    const { data: userFolders, error: folderError } = await supabase.storage
      .from('lessons')
      .list('facilitator-lessons', { limit: 1000 })
    
    if (folderError) {
      console.error('Storage folder list error:', folderError)
      return NextResponse.json([])
    }
    
    console.log('Found folders:', userFolders?.length, 'items in facilitator-lessons')
    console.log('Folder details:', JSON.stringify(userFolders?.slice(0, 3), null, 2))
    
    const out = []
    
    // Iterate through each user folder
    for (const folder of userFolders || []) {
      // Skip if it's a file (has metadata property) rather than a folder
      // Folders in Supabase Storage typically don't have metadata property or have null id
      console.log('Processing folder:', folder.name, 'has metadata?', !!folder.metadata, 'id:', folder.id)
      if (folder.metadata || !folder.name) {
        console.log('Skipping', folder.name, '- appears to be a file')
        continue
      }
      
      try {
        // List files in this user's folder
        const { data: files, error: listError } = await supabase.storage
          .from('lessons')
          .list(`facilitator-lessons/${folder.name}`, { limit: 1000 })
        
        if (listError) {
          console.error(`Error listing files in ${folder.name}:`, listError)
          continue
        }
        
        console.log(`Found ${files?.length || 0} files in ${folder.name}`)
        
        // Process each file
        for (const fileObj of files || []) {
          console.log('Processing file:', fileObj.name, 'in folder', folder.name)
          if (!fileObj.name.toLowerCase().endsWith('.json')) {
            console.log('Skipping non-JSON file:', fileObj.name)
            continue
          }
          try {
            // Download and parse each file
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('lessons')
              .download(`facilitator-lessons/${folder.name}/${fileObj.name}`)
            
            if (downloadError) {
              console.error(`Error downloading ${fileObj.name}:`, downloadError)
              continue
            }
            
            const raw = await fileData.text()
            const js = JSON.parse(raw)
            const subj = (js.subject || '').toString().toLowerCase()
            const approved = js.approved === true
            const needsUpdate = js.needsUpdate === true
            out.push({ 
              file: fileObj.name, 
              userId: folder.name,
              title: js.title || fileObj.name, 
              grade: js.grade || null, 
              difficulty: (js.difficulty || '').toLowerCase(), 
              subject: subj || null, 
              approved, 
              needsUpdate 
            })
          } catch (parseError) {
            console.error('Parse error for', fileObj.name, parseError)
          }
        }
      } catch (userFolderError) {
        console.error(`Error processing folder ${folder.name}:`, userFolderError)
      }
    }
    
    return NextResponse.json(out)
  } catch (e) {
    console.error('List error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
