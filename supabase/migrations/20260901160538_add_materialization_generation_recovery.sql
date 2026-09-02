-- Recover exact materialization artifacts after process death without blind regeneration.

alter table public.syllabus_forecast_materializations
  add column if not exists storage_path text,
  add column if not exists generator_completed_at timestamptz,
  add column if not exists quota_charged_at timestamptz;

alter table public.syllabus_forecast_materializations
  drop constraint if exists syllabus_forecast_materialization_status_check;
alter table public.syllabus_forecast_materializations
  add constraint syllabus_forecast_materialization_status_check
  check (status in ('generating', 'generated', 'binding_failed', 'bound', 'generation_failed', 'recovery_required'));

alter table public.syllabus_forecast_materializations
  drop constraint if exists syllabus_forecast_materialization_storage_path_check;
alter table public.syllabus_forecast_materializations
  add constraint syllabus_forecast_materialization_storage_path_check
  check (storage_path is null or length(btrim(storage_path)) > 0);

create or replace function public.claim_syllabus_forecast_materialization(
  p_syllabus_id uuid,
  p_lineage_id uuid,
  p_generation_input_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  receipt public.syllabus_forecast_materializations%rowtype;
begin
  perform 1 from public.syllabi where id = p_syllabus_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Syllabus not found'; end if;

  select * into receipt from public.syllabus_forecast_materializations
  where syllabus_id = p_syllabus_id and lineage_id = p_lineage_id for update;

  if not found then
    insert into public.syllabus_forecast_materializations (syllabus_id, lineage_id, generation_input_hash, status)
    values (p_syllabus_id, p_lineage_id, p_generation_input_hash, 'generating')
    returning * into receipt;
    return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', true);
  end if;

  if receipt.lesson_key is not null then
    return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', false);
  end if;
  if receipt.status in ('generating', 'recovery_required') then
    return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', false);
  end if;

  update public.syllabus_forecast_materializations
  set generation_input_hash = p_generation_input_hash,
      storage_path = null,
      generator_completed_at = null,
      quota_charged_at = null,
      status = 'generating',
      last_error = null,
      updated_at = now()
  where id = receipt.id returning * into receipt;
  return jsonb_build_object('receipt', to_jsonb(receipt), 'claimed', true);
end;
$$;

revoke all on function public.claim_syllabus_forecast_materialization(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_syllabus_forecast_materialization(uuid, uuid, text)
  to service_role;

create or replace function public.complete_syllabus_materialization_generation(
  p_receipt_id uuid,
  p_facilitator_id uuid,
  p_learner_id uuid,
  p_generation_input_hash text,
  p_lesson_key text,
  p_storage_path text,
  p_charge_quota boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  receipt public.syllabus_forecast_materializations%rowtype;
  expected_file text;
  expected_lesson_key text;
  expected_storage_path text;
  charged_at timestamptz;
begin
  select materialization.* into receipt
  from public.syllabus_forecast_materializations materialization
  join public.syllabi syllabus on syllabus.id = materialization.syllabus_id
  where materialization.id = p_receipt_id
    and syllabus.facilitator_id = p_facilitator_id
    and syllabus.learner_id = p_learner_id
  for update of materialization;
  if not found then raise exception using errcode = 'P0002', message = 'Materialization operation not found'; end if;
  if receipt.generation_input_hash is distinct from p_generation_input_hash then
    raise exception using errcode = '40001', message = 'Materialization operation input changed';
  end if;

  expected_file := 'syllabus-materialization-' || receipt.id::text || '.json';
  expected_lesson_key := 'generated/' || expected_file;
  expected_storage_path := 'facilitator-lessons/' || p_facilitator_id::text || '/' || expected_file;
  if p_lesson_key is distinct from expected_lesson_key or p_storage_path is distinct from expected_storage_path then
    raise exception 'Materialization artifact identity is not canonical';
  end if;
  if receipt.lesson_key is not null and receipt.lesson_key is distinct from expected_lesson_key then
    raise exception using errcode = '40001', message = 'Materialization receipt is bound to another artifact';
  end if;

  charged_at := receipt.quota_charged_at;
  if p_charge_quota and charged_at is null then
    update public.profiles
    set lifetime_generations_used = coalesce(lifetime_generations_used, 0) + 1
    where id = p_facilitator_id;
    if not found then raise exception using errcode = 'P0002', message = 'Facilitator quota record not found'; end if;
    charged_at := now();
  end if;

  update public.syllabus_forecast_materializations
  set lesson_key = expected_lesson_key,
      storage_path = expected_storage_path,
      status = 'generated',
      generator_completed_at = coalesce(generator_completed_at, now()),
      quota_charged_at = charged_at,
      last_error = null,
      updated_at = now()
  where id = receipt.id
  returning * into receipt;

  return to_jsonb(receipt);
end;
$$;

revoke all on function public.complete_syllabus_materialization_generation(uuid, uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_syllabus_materialization_generation(uuid, uuid, uuid, text, text, text, boolean)
  to service_role;

comment on column public.syllabus_forecast_materializations.storage_path is
  'Exact deterministic Storage path owned by the materialization receipt operation.';
comment on column public.syllabus_forecast_materializations.generator_completed_at is
  'First time the exact canonical artifact was durably finalized for this operation.';
comment on column public.syllabus_forecast_materializations.quota_charged_at is
  'Atomic exactly-once finite-tier quota charge for this materialization operation.';
