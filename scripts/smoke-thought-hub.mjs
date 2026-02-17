// ThoughtHub smoke test
//
// Usage:
//   THOUGHTHUB_TOKEN="<supabase access token>" node scripts/smoke-thought-hub.mjs
// Optional:
//   THOUGHTHUB_BASE_URL="http://localhost:3001" (default)
//   THOUGHTHUB_SUBJECT_KEY="facilitator" (default)
//
// Notes:
// - This validates the HTTP surface. It does not validate cookie-based ownership for /api/mentor-session.

const baseUrl = (process.env.THOUGHTHUB_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
const token = (process.env.THOUGHTHUB_TOKEN || '').trim()
const subjectKey = (process.env.THOUGHTHUB_SUBJECT_KEY || 'facilitator').trim()

if (!token) {
  console.error('Missing THOUGHTHUB_TOKEN env var (Supabase access token).')
  process.exit(2)
}

async function httpJson(url, init = {}) {
  const res = await fetch(url, init)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { _nonJson: text }
  }
  return { res, json }
}

async function main() {
  const headers = { Authorization: `Bearer ${token}` }

  // 1) ThoughtHub chronograph
  {
    const url = `${baseUrl}/api/thought-hub-chronograph?subjectKey=${encodeURIComponent(subjectKey)}&mode=minimal`
    const { res, json } = await httpJson(url, { headers, cache: 'no-store' })
    console.log('GET /api/thought-hub-chronograph:', res.status)
    if (!res.ok) {
      console.log(json)
      process.exit(1)
    }
    console.log('  history_len:', Array.isArray(json?.history) ? json.history.length : null)
    console.log('  has_pack:', !!json?.pack)
  }

  // 2) ThoughtHub-enabled counselor POST
  {
    const message = `ThoughtHub smoke ping @ ${new Date().toISOString()}`
    const url = `${baseUrl}/api/counselor`
    const { res, json } = await httpJson(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        history: [],
        use_thought_hub: true,
        thought_hub_mode: 'minimal',
        subject_key: subjectKey,
        require_generation_confirmation: false,
        generation_confirmed: true,
        disableTools: []
      })
    })

    console.log('POST /api/counselor (ThoughtHub):', res.status)
    if (!res.ok) {
      console.log(json)
      process.exit(1)
    }
    console.log('  got_audio:', !!json?.audio)
    console.log('  reply_len:', typeof json?.response === 'string' ? json.response.length : null)
  }

  // 3) Confirm the message made it into the chronograph
  {
    const url = `${baseUrl}/api/thought-hub-chronograph?subjectKey=${encodeURIComponent(subjectKey)}&mode=minimal`
    const { res, json } = await httpJson(url, { headers, cache: 'no-store' })
    console.log('GET /api/thought-hub-chronograph (after):', res.status)
    if (!res.ok) {
      console.log(json)
      process.exit(1)
    }
    const last = Array.isArray(json?.history) ? json.history[json.history.length - 1] : null
    console.log('  last_role:', last?.role)
    console.log('  last_has_content:', typeof last?.content === 'string' && last.content.length > 0)
  }

  console.log('ThoughtHub smoke OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
