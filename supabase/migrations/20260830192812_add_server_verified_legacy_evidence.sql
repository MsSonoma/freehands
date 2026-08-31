-- Add server-verified, pre-occurrence transcript provenance without rewriting
-- the already-applied historical-activity foundation migration.

alter table public.syllabus_legacy_activity_records
  add column evidence_reference text,
  add column evidence_version text,
  add column evidence_digest text;

alter table public.syllabus_legacy_activity_records
  drop constraint syllabus_legacy_activity_provenance_check,
  add constraint syllabus_legacy_activity_provenance_check check (
    provenance = 'facilitator_recorded_legacy_activity'
    or (
      provenance = 'facilitator_attested_webb_completion_v1_import'
      and activity_type = 'instructional_completion'
      and instructional_teacher = 'webb'
    )
    or (
      provenance = 'server_verified_legacy_transcript_v1'
      and (
        (activity_type = 'instructional_completion' and instructional_teacher = 'webb')
        or (activity_type = 'slate_drill_completion' and instructional_teacher is null)
      )
    )
  ),
  add constraint syllabus_legacy_activity_records_verified_evidence_check check (
    (
      provenance = 'server_verified_legacy_transcript_v1'
      and evidence_reference is not null
      and length(btrim(evidence_reference)) > 0
      and evidence_version = 'pre_occurrence_transcript_ledger_v1'
      and evidence_digest ~ '^[0-9a-f]{64}$'
      and syllabus_occurrence_id ~ '^legacy-evidence:[0-9a-f]{64}$'
    )
    or (
      provenance <> 'server_verified_legacy_transcript_v1'
      and evidence_reference is null
      and evidence_version is null
      and evidence_digest is null
    )
  );

comment on column public.syllabus_legacy_activity_records.evidence_reference is
  'Server-only private storage reference used to audit verified pre-Syllabus history. Never expose through learner reads.';
comment on column public.syllabus_legacy_activity_records.evidence_version is
  'Versioned server verification rule for the surviving legacy writer format.';
comment on column public.syllabus_legacy_activity_records.evidence_digest is
  'SHA-256 of the uniquely verified immutable ledger segment used to derive the legacy-evidence occurrence.';
comment on column public.syllabus_legacy_activity_records.syllabus_occurrence_id is
  'Exact active occurrence for facilitator entry, or deterministic legacy-evidence identity for server-verified pre-Syllabus history.';
comment on column public.syllabus_legacy_activity_records.provenance is
  'Manual/attested occurrence-bound history or server-verified legacy transcript evidence; none is canonical learning evidence.';
comment on table public.syllabus_legacy_activity_records is
  'Append-only display history from exact facilitator-attested occurrences or server-verified pre-Syllabus ledgers. Never canonical instruction, mastery, retention, or membership.';

-- The foundation table remains append-only and service-role-only. This migration
-- intentionally contains no historical DML or canonical learning/session writes.
