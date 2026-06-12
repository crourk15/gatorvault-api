-- FutureCast Phase 1 — unique player_id on uf_specific_profiles (upsert support)
-- Run if 005 was applied before the unique index was added.
-- @see server/models/uf-specific-profile.ts

drop index if exists futurecast.idx_uf_profiles_player_id;

create unique index if not exists idx_uf_profiles_player_id
  on futurecast.uf_specific_profiles (player_id);

create index if not exists idx_uf_profiles_status
  on futurecast.uf_specific_profiles (uf_status);
