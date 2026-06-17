-- Competing school rank history — rivals PM prediction leaderboard changes
-- player_id matches futurecast.players (uuid)

create table if not exists futurecast.competing_school_history (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references futurecast.players(id) on delete cascade,
  school      text not null,
  rank        int not null check (rank >= 1),
  created_at  timestamptz not null default now()
);

create index if not exists idx_competing_school_history_player_school
  on futurecast.competing_school_history (player_id, school, created_at desc);

create index if not exists idx_competing_school_history_created
  on futurecast.competing_school_history (created_at desc);
