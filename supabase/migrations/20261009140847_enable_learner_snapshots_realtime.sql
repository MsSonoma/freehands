-- Enable live facilitator observation of learner Liftoff snapshot progress.
-- learner_snapshots already enforces owner-scoped RLS; this only adds the table
-- to Supabase Realtime's Postgres Changes publication.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'learner_snapshots'
  ) then
    execute 'alter publication supabase_realtime add table public.learner_snapshots';
  end if;
end
$$;
