import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFacilitatorPinForUser } from '@/app/lib/facilitatorPin.server.mjs';
import { AI_MODEL, aiModelTemperature } from '@/app/lib/aiModel';
import { normalizeFacilitatorQuestionCandidate } from '@/app/lib/facilitatorOverrideQuestion.mjs';

export const runtime = 'nodejs';
export const maxDuration = 45;
export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!token || !url || !anon || !service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data: { user } } = await client.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body?.kind !== 'question' || body?.scope !== 'instance' || !['sonoma','slate','webb'].includes(body.teacher)) {
      return NextResponse.json({ error: 'Unsupported regeneration target' }, { status: 400 });
    }
    const feedback = String(body.feedback || '').trim();
    const original = body.original;
    if (feedback.length < 8 || feedback.length > 1500 || !original?.question) return NextResponse.json({ error: 'Describe the problem with this question' }, { status: 400 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    if (!await verifyFacilitatorPinForUser(svc, user.id, String(body.pin || ''))) return NextResponse.json({ error: 'Invalid facilitator PIN' }, { status: 403 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: 'Question generator unavailable' }, { status: 503 });
    const prompt = `Regenerate ONE educational question following a facilitator correction. Return a JSON object ONLY, no markdown. Keep the skill objective, grade, question type and complexity; do not expand into multi-part demands. Do not repeat the original question. Preserve assessment purpose. For multiplechoice or mc return {question, choices:[four distinct strings],correct:integer 0-3}; for truefalse/tf return {question,answer:boolean}; for shortanswer, short, fib, fill, fillintheblank return {question,expectedAny:[at least 2 reasonable answers]}; fill-in questions must contain "_____". No unrelated edits.\nTeacher: ${body.teacher}\nPhase: ${String(body.phase || '').slice(0,40)}\nGrade: ${String(body.grade || '').slice(0,30)}\nTarget objective: ${String(original.objectiveId || original.objective_id || body.objective || '').slice(0,300)}\nOriginal question: ${JSON.stringify({ question: String(original.question).slice(0,1200), type: original.type || original.sourceType, choices: original.choices || original.options, expectedAny: original.expectedAny })}\nWhat went wrong (facilitator): ${feedback}`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role:'system', content:'Produce only a JSON object. No markdown.' }, { role:'user', content:prompt }], ...aiModelTemperature(0.4) }),
    });
    if (!response.ok) return NextResponse.json({ error: 'Question regeneration failed' }, { status: 502 });
    const json = await response.json();
    const content = String(json?.choices?.[0]?.message?.content || '').trim();
    let parsed;
    try { parsed = JSON.parse(content); } catch { return NextResponse.json({ error: 'Generator returned invalid JSON' }, { status: 502 }); }
    const candidate = normalizeFacilitatorQuestionCandidate(original, { ...parsed, replacementId: crypto.randomUUID() });
    if (!candidate) return NextResponse.json({ error: 'Replacement failed question-format validation. No changes applied.' }, { status: 422 });
    return NextResponse.json({ ok: true, proposal: candidate });
  } catch (error) {
    console.warn('[FacilitatorOverride] Question preview failed', error?.message);
    return NextResponse.json({ error: 'Unable to prepare question replacement' }, { status: 500 });
  }
}
