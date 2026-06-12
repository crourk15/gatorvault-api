-- FutureCast Phase 1 — UFSpecificProfile table (Issue #16)
-- @see server/docs/futurecast-platform-spec.md §1.5
-- @see server/models/uf-specific-profile.ts
--
-- Requires: server/migrations/001_create_player_table.sql
-- Apply via Supabase SQL Editor or: psql $DATABASE_URL -f server/migrations/005_create_uf_specific_profiles_table.sql

create schema if not exists futurecast;

do $migrate$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'uf_status'
      and n.nspname = 'futurecast'
  ) then
    create type futurecast.uf_status as enum (
      'TARGET',
      'PRIORITY',
      'COMMITTED',
      'EVAL',
      'NOT_INTERESTED'
    );
  end if;
end
$migrate$;

create table if not exists futurecast.uf_specific_profiles (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null references futurecast.players(id) on delete cascade,
  uf_fit_score          integer,
  athletic_score        integer,
  scheme_score          integer,
  character_score       integer,
  timeline_score        integer,
  uf_status             futurecast.uf_status,
  uf_commit_probability integer,
  score_computed_at     timestamptz,
  depth_chart_path      text,
  evaluation_notes      text,
  tags                  text[] not null default '{}'::text[],
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists idx_uf_profiles_player_id
  on futurecast.uf_specific_profiles (player_id);

create index if not exists idx_uf_profiles_status
  on futurecast.uf_specific_profiles (uf_status);

drop trigger if exists futurecast_uf_profiles_updated_at on futurecast.uf_specific_profiles;
create trigger futurecast_uf_profiles_updated_at
  before update on futurecast.uf_specific_profiles
  for each row execute function futurecast.set_updated_at();
