import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFacilitatorPinForUser } from '@/app/lib/facilitatorPin.server.mjs';
import { normalizeFacilitatorQuestionCandidate } from '@/app/lib/facilitatorOverrideQuestion.mjs';
import { buildCanonicalLessonIdentity } from '@/app/lib/facilitatorPreparation.mjs';

export const runtime = 'nodejs';
const FIELDS = new Set(['truefalse','multiplechoice','shortanswer','fillintheblank','worksheet','test','comprehension','exercise','sample']);

/** Never overwrite the historical source. Create a fresh unapproved generated lesson revision. */
export async function POST(req) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/, '');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!token || !url || !anon || !service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data: { user } } = await client.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const lessonKey = String(body.lessonKey || '');
    const file = lessonKey.replace(/^generated\//, '');
    if (!/^generated\/[a-zA-Z0-9._-]+\.json$/.test(lessonKey) || !FIELDS.has(body.field) ||
        !Number.isInteger(body.index) || body.index < 0 ||
        String(body.feedback || '').trim().length < 8 || !body.original?.question || !body.proposal?.question) {
      return NextResponse.json({ error: 'Invalid source revision request' }, { status: 400 });
    }
    const svc = createClient(url, service, { auth: { persistSession: false } });
    if (!await verifyFacilitatorPinForUser(svc, user.id, String(body.pin || ''))) {
      return NextResponse.json({ error: 'Invalid facilitator PIN' }, { status: 403 });
    }
    const storage = svc.storage.from('lessons');
    const path = `facilitator-lessons/${user.id}/${file}`;
    const { data: fileData, error: readError } = await storage.download(`${path}?revision=${Date.now()}`);
    if (readError || !fileData) return NextResponse.json({ error: 'Source lesson not found or not owned by facilitator' }, { status: 404 });
    const originalLesson = JSON.parse(await fileData.text());
    const rows = originalLesson[body.field];
    const originalItem = Array.isArray(rows) ? rows[body.index] : null;
    if (!originalItem || String(originalItem.question || originalItem.Q || originalItem.q || originalItem.prompt || originalItem.text || '').trim() !== String(body.original.question).trim() ||
        (originalItem.id && body.original.id && String(originalItem.id) !== String(body.original.id))) {
      return NextResponse.json({ error: 'The source question changed. Refresh and review the latest version.' }, { status: 409 });
    }
    const candidate = normalizeFacilitatorQuestionCandidate({ ...originalItem, question: String(body.original.question),
      type: originalItem.type || body.original.type || body.original.sourceType || (body.field === 'test' ? 'shortanswer' : body.field) },
      { ...body.proposal, replacementId: crypto.randomUUID() });
    if (!candidate) return NextResponse.json({ error: 'Replacement failed source question validation' }, { status: 422 });
    const revisedRows = [...rows];
    revisedRows[body.index] = candidate;
    const filename = `${file.replace(/\.json$/, '').slice(0,100)}-rev-${Date.now()}-${crypto.randomUUID().slice(0,8)}.json`;
    const nextPath = `facilitator-lessons/${user.id}/${filename}`;
    const revision = {
      ...originalLesson, [body.field]: revisedRows,
      id: `revision-${crypto.randomUUID()}`, file: filename, lessonKey: `generated/${filename}`,
      approved: false, needsUpdate: true,
      revisionOf: lessonKey, revisionAt: new Date().toISOString(),
      revisionReason: String(body.feedback).trim().slice(0,1500),
    };
    delete revision.materialization_operation;
    delete revision.materializationOperation;
    const { error: writeError } = await storage.upload(nextPath, JSON.stringify(revision, null, 2), {
      contentType: 'application/json', upsert: false, cacheControl: '0',
    });
    if (writeError) return NextResponse.json({ error: 'Could not create a new lesson version' }, { status: 500 });
    const { data: savedData, error: confirmError } = await storage.download(`${nextPath}?verify=${Date.now()}-${crypto.randomUUID()}`);
    if (confirmError || !savedData) return NextResponse.json({ error: 'The new draft was written, but readback is not yet confirmed. Check your lesson drafts before retrying.', code: 'REVISION_READBACK_PENDING' }, { status: 503 });
    const saved = JSON.parse(await savedData.text());
    if (saved.revisionOf !== lessonKey || saved[body.field]?.[body.index]?.question !== candidate.question) {
      return NextResponse.json({ error: 'Source revision readback mismatch. The draft was not confirmed.', code: 'REVISION_READBACK_MISMATCH' }, { status: 503 });
    }
    const identity = buildCanonicalLessonIdentity({ file: filename, ownerId: user.id, storagePath: nextPath });
    return NextResponse.json({ ok: true, newDraft: identity, revisionOf: lessonKey,
      message: 'A new lesson draft version was created. Approve it separately before assigning it to learners.' });
  } catch (error) {
    console.warn('[FacilitatorOverride] Source revision failed', error?.message);
    return NextResponse.json({ error: 'Unable to create a new source revision' }, { status: 500 });
  }
}
