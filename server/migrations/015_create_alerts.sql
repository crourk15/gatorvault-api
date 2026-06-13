-- FutureCast — movement and volatility alerts
-- @see server/models/alerts.ts

create table if not exists futurecast.alerts (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references futurecast.players(id) on delete cascade,
  type        text not null,
  message     text not null,
  created_at  timestamptz not null default now(),
  seen        boolean not null default false
);

create index if not exists idx_alerts_created_at
  on futurecast.alerts (created_at desc);

create index if not exists idx_alerts_player_id
  on futurecast.alerts (player_id);
