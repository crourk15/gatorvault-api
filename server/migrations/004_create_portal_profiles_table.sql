-- FutureCast Phase 1 — PortalProfile table (Issue #15)
-- @see server/docs/futurecast-platform-spec.md §1.4
-- @see server/models/portal-profile.ts
--
-- Requires: server/migrations/001_create_player_table.sql
-- Apply via Supabase SQL Editor or: psql $DATABASE_URL -f server/migrations/004_create_portal_profiles_table.sql

create schema if not exists futurecast;

do $migrate$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'portal_status'
      and n.nspname = 'futurecast'
  ) then
    create type futurecast.portal_status as enum (
      'IN_PORTAL',
      'COMMITTED',
      'WITHDRAWN',
      'TRANSFERRED'
    );
  end if;
end
$migrate$;

create table if not exists futurecast.portal_profiles (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null references futurecast.players(id) on delete cascade,
  previous_school       text,
  entered_portal_at     timestamptz,
  exited_portal_at      timestamptz,
  portal_status         futurecast.portal_status not null,
  destination_school    text,
  eligibility_remaining integer,
  reason_tags           text[] not null default '{}'::text[],
  portal_likelihood     integer,
  likelihood_reason     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists idx_portal_profiles_player_id
  on futurecast.portal_profiles (player_id);

create index if not exists idx_portal_profiles_status
  on futurecast.portal_profiles (portal_status);

drop trigger if exists futurecast_portal_profiles_updated_at on futurecast.portal_profiles;
create trigger futurecast_portal_profiles_updated_at
  before update on futurecast.portal_profiles
  for each row execute function futurecast.set_updated_at();
