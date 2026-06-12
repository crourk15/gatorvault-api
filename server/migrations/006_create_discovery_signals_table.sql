-- FutureCast Phase 1 — DiscoverySignal table (Issue #17)
-- @see server/docs/futurecast-platform-spec.md §1.6
-- @see server/models/discovery-signal.ts
--
-- Immutable event log — no updated_at column.
-- Requires: server/migrations/001_create_player_table.sql
-- Apply via Supabase SQL Editor or: psql $DATABASE_URL -f server/migrations/006_create_discovery_signals_table.sql

create schema if not exists futurecast;

do $migrate$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'signal_type'
      and n.nspname = 'futurecast'
  ) then
    create type futurecast.signal_type as enum (
      'OFFER',
      'RANKING_JUMP',
      'CAMP_PERFORMANCE',
      'EVALUATION_NOTE',
      'SOCIAL_MOMENTUM',
      'PORTAL_ACTIVITY',
      'STAFF_FLAG',
      'OTHER'
    );
  end if;
end
$migrate$;

create table if not exists futurecast.discovery_signals (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references futurecast.players(id) on delete cascade,
  signal_type   futurecast.signal_type not null,
  signal_value  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_discovery_signals_player_id
  on futurecast.discovery_signals (player_id);

create index if not exists idx_discovery_signals_type
  on futurecast.discovery_signals (signal_type);
