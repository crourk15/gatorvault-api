-- FutureCast Phase 1 — Player table (Issue #12)
-- @see server/docs/futurecast-platform-spec.md §1.1
-- @see server/models/player.ts
--
-- Uses schema `futurecast` to coexist with legacy public.players (recruiting store).
-- Apply via Supabase SQL Editor or: psql $DATABASE_URL -f server/migrations/001_create_player_table.sql

create extension if not exists "pgcrypto";

create schema if not exists futurecast;

create table if not exists futurecast.players (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  full_name         text not null,
  position          text not null,
  class_year        integer not null,
  height            integer,
  weight            integer,
  hometown          text,
  state             text,
  high_school       text,
  stars             integer,
  composite_rating  numeric(4, 3),
  ranking_national  integer,
  ranking_position  integer,
  ranking_state     integer,
  status            text not null check (status in ('HS', 'COLLEGE', 'PORTAL')),
  committed_to      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint futurecast_players_slug_key unique (slug)
);

create index if not exists idx_players_classyear_position
  on futurecast.players (class_year, position);

create unique index if not exists idx_players_slug
  on futurecast.players (slug);

-- Reuse set_updated_at() if already defined by server/supabase/schema.sql
create or replace function futurecast.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists futurecast_players_updated_at on futurecast.players;
create trigger futurecast_players_updated_at
  before update on futurecast.players
  for each row execute function futurecast.set_updated_at();
