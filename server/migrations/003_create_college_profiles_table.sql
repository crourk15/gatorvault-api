-- FutureCast Phase 1 — CollegeProfile table (Issue #14)
-- @see server/docs/futurecast-platform-spec.md §1.3
-- @see server/models/college-profile.ts
--
-- Requires: server/migrations/001_create_player_table.sql
-- Apply via Supabase SQL Editor or: psql $DATABASE_URL -f server/migrations/003_create_college_profiles_table.sql

create schema if not exists futurecast;

create table if not exists futurecast.college_profiles (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references futurecast.players(id) on delete cascade,
  college         text not null,
  years_played    integer,
  games_played    integer,
  snaps           jsonb not null default '{}'::jsonb,
  stats           jsonb not null default '{}'::jsonb,
  depth_history   jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_college_profiles_player_id
  on futurecast.college_profiles (player_id);

drop trigger if exists futurecast_college_profiles_updated_at on futurecast.college_profiles;
create trigger futurecast_college_profiles_updated_at
  before update on futurecast.college_profiles
  for each row execute function futurecast.set_updated_at();
