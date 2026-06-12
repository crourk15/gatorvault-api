-- FutureCast Phase 1 — unique player_id on college_profiles (upsert support)
-- Run if 003 was applied before the unique index was added.
-- @see server/models/college-profile.ts

drop index if exists futurecast.idx_college_profiles_player_id;

create unique index if not exists idx_college_profiles_player_id
  on futurecast.college_profiles (player_id);
