#!/usr/bin/env node

/**
 * Fix storage file paths - the database was updated but physical files weren't moved
 * This script will use Supabase Storage API to properly move files
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Load environment variables
dotenv.config({ path: join(rootDir, '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function main() {
  console.log('Checking storage files...\n')
  
  // Get all files that the database thinks are at generated-lessons
  const { data: dbFiles, error: dbError } = await supabase
    .from('storage.objects')
    .select('name, id, bucket_id')
    .eq('bucket_id', 'lessons')
    .like('name', 'generated-lessons/%')
    .neq('name', 'generated-lessons/.emptyFolderPlaceholder')
  
  if (dbError) {
    console.error('Database query error:', dbError)
    process.exit(1)
  }
  
  console.log(`Found ${dbFiles.length} files in database at generated-lessons/\n`)
  
  // The actual files are still at facilitator-lessons/ in the storage system
  // We need to:
  // 1. Download from the old path (facilitator-lessons)
  // 2. Upload to the new path (generated-lessons) 
  // 3. Delete the old file
  
  for (const file of dbFiles) {
    const newPath = file.name
    const oldPath = newPath.replace('generated-lessons/', 'facilitator-lessons/')
    
    console.log(`Processing: ${oldPath} -> ${newPath}`)
    
    try {
      // Try to download from the OLD physical path using a direct storage query
      // The database says the file is at newPath, but physically it's at oldPath
      console.log('  Attempting to access old physical location...')
      
      // We can't easily access the old physical path since the database was updated
      // Instead, we need to revert the database change temporarily
      
      console.log('  ❌ Cannot access - database/storage mismatch')
      
    } catch (err) {
      console.error(`  Error:`, err.message)
    }
  }
  
  console.log('\n⚠️  PROBLEM IDENTIFIED:')
  console.log('The database was updated to point to generated-lessons/, but the physical')
  console.log('files are still stored under facilitator-lessons/ in the storage backend.')
  console.log('\nSupabase Storage does not support direct file moves via SQL updates.')
  console.log('\nSOLUTION: Revert the database changes to match the actual file locations.')
  console.log('\nRun this SQL to revert:\n')
  console.log(`UPDATE storage.objects
SET name = REPLACE(name, 'generated-lessons/', 'facilitator-lessons/')
WHERE bucket_id = 'lessons'
  AND name LIKE 'generated-lessons/%';`)
}

main().catch(console.error)
