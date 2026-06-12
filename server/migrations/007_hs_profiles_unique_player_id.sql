-- FutureCast Phase 1 — unique player_id on high_school_profiles (upsert support)
-- Run if 002 was applied before the unique index was added.
-- @see server/models/highschool-profile.ts

drop index if exists futurecast.idx_hs_profiles_player_id;

create unique index if not exists idx_hs_profiles_player_id
  on futurecast.high_school_profiles (player_id);
