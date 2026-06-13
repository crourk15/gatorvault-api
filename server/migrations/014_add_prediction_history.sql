-- FutureCast Phase 9 — daily MODEL confidence history for movement graph
-- @see client/components/player/MovementHistoryGraph.tsx

create table if not exists futurecast.prediction_history (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references futurecast.players(id) on delete cascade,
  date        date not null,
  confidence  int not null check (confidence >= 0 and confidence <= 100),
  unique (player_id, date)
);

create index if not exists idx_prediction_history_player_date
  on futurecast.prediction_history (player_id, date asc);

insert into futurecast.prediction_history (player_id, date, confidence)
select player_id, current_date, confidence
from futurecast.predictions
where status = 'ACTIVE' and source_type = 'MODEL'
on conflict (player_id, date) do nothing;
