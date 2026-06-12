-- FutureCast Phase 1 — unique player_id on portal_profiles (upsert support)
-- Run if 004 was applied before the unique index was added.
-- @see server/models/portal-profile.ts

drop index if exists futurecast.idx_portal_profiles_player_id;

create unique index if not exists idx_portal_profiles_player_id
  on futurecast.portal_profiles (player_id);

create index if not exists idx_portal_profiles_status
  on futurecast.portal_profiles (portal_status);
