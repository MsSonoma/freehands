# Supabase Storage: Transcripts bucket setup

This app archives per-learner, per-lesson transcripts to Supabase Storage as:

- Ledger JSON: `transcripts/v1/{ownerId}/{learnerId}/{lessonId}/ledger.json`
- Consolidated PDF: `transcripts/v1/{ownerId}/{learnerId}/{lessonId}/transcript.pdf`

Where `ownerId` is the authenticated facilitator's `auth.users.id` (the profile/tenant owner).

The UI reads/writes using the logged-in facilitator session.

## 1) Create the Storage bucket

In Supabase Dashboard → Storage → Create bucket:

- Name: `transcripts`
- Public: Off (private bucket)
- Description: Transcript ledger and PDFs

## 2) (Optional) Folder structure

No pre-seeding required; the app creates folders on first write.

## 3) Policies

Storage uses RLS via `storage.objects`. Create policies to restrict access so that facilitators can read/write only their own subtree. We recommend allowing reads/writes for authenticated users under their own `ownerId` path, and disallowing deletes through the API (soft no-delete policy).

Replace the schema name if you renamed auth schema. Default is `auth`.

```sql
-- Helper: Extract the ownerId (user id) from the object path
-- Path format: v1/{ownerId}/{learnerId}/{lessonId}/...
create or replace function public.transcripts_owner_id_from_path(path text)
returns uuid language sql stable as $$
  select nullif(split_part(path, '/', 2), '')::uuid; -- v1 / {ownerId} / ...
$$;

-- Allow INSERT/UPDATE only when path ownerId matches auth.uid()
create policy "transcripts upsert own subtree"
  on storage.objects for insert
  with check (
    bucket_id = 'transcripts'
    and public.transcripts_owner_id_from_path(name) = auth.uid()
  );

create policy "transcripts update own subtree"
  on storage.objects for update
  using (
    bucket_id = 'transcripts'
    and public.transcripts_owner_id_from_path(name) = auth.uid()
  )
  with check (
    bucket_id = 'transcripts'
    and public.transcripts_owner_id_from_path(name) = auth.uid()
  );

-- Allow SELECT of own subtree
create policy "transcripts read own subtree"
  on storage.objects for select
  using (
    bucket_id = 'transcripts'
    and public.transcripts_owner_id_from_path(name) = auth.uid()
  );

-- Optional: disallow DELETEs via RLS (soft no-delete)
-- If you still need admin cleanup, run via service role on the server.
create policy "transcripts no delete via client"
  on storage.objects for delete
  using (false);
```

Notes:
- Policies reference `storage.objects.name` directly and parse it using `split_part`. No extra helper functions are required.
- The app uses `createSignedUrl` to hand the browser a time-limited URL for each `transcript.pdf`. SELECT policy must allow access to matching paths.
- The client uses `upload(..., { upsert: true })` for ledger and PDF.

## 4) Profiles linkage

The app reads the facilitator id from the current auth session. Ensure your auth flow yields a valid `auth.uid()` and your `profiles` table row exists for the user. No additional DB tables are required for transcripts.

## 5) Retention / audit guidance

- App-level behavior never deletes ledger entries and always regenerates `transcript.pdf` from the full ledger.
- Enforce retention on the bucket with lifecycle rules if desired. If strict legal retention is required, consider mirroring ledger JSONs to an immutable archive (e.g., object lock or WORM) via a server task.

## 6) Local testing

- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
- Sign in to the app to ensure `auth.uid()` is present.
- Complete a lesson in `/session` to trigger a write. Then visit `/facilitator/learners/{id}/transcripts` to see signed links.
