-- FutureCast Phase 1 — HighSchoolProfile table (Issue #13)
-- @see server/docs/futurecast-platform-spec.md §1.2
-- @see server/models/highschool-profile.ts
--
-- Requires: server/migrations/001_create_player_table.sql
-- Apply via Supabase SQL Editor or: psql $DATABASE_URL -f server/migrations/002_create_high_school_profiles_table.sql

create schema if not exists futurecast;

create table if not exists futurecast.high_school_profiles (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references futurecast.players(id) on delete cascade,
  offers            jsonb not null default '[]'::jsonb,
  stats             jsonb not null default '{}'::jsonb,
  recruiting_notes  text,
  discovery_score   integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists idx_hs_profiles_player_id
  on futurecast.high_school_profiles (player_id);

drop trigger if exists futurecast_hs_profiles_updated_at on futurecast.high_school_profiles;
create trigger futurecast_hs_profiles_updated_at
  before update on futurecast.high_school_profiles
  for each row execute function futurecast.set_updated_at();
