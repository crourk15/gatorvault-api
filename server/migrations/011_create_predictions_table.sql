-- FutureCast Phase 8 — Predictions (FutureCast Picks)
-- @see server/models/predictions.ts
-- Requires: server/migrations/001_create_player_table.sql

create schema if not exists futurecast;

do $migrate$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'prediction_source_type' and n.nspname = 'futurecast'
  ) then
    create type futurecast.prediction_source_type as enum (
      'MODEL',
      'STAFF',
      'FAN',
      'BLENDED'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'prediction_status' and n.nspname = 'futurecast'
  ) then
    create type futurecast.prediction_status as enum (
      'ACTIVE',
      'HIT',
      'MISS',
      'WITHDRAWN'
    );
  end if;
end
$migrate$;

create table if not exists futurecast.predictions (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references futurecast.players(id) on delete cascade,
  school        text not null,
  confidence    int not null check (confidence >= 0 and confidence <= 100),
  source_type   futurecast.prediction_source_type not null,
  predictor_id  text not null default 'system',
  status        futurecast.prediction_status not null default 'ACTIVE',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_predictions_player_id
  on futurecast.predictions (player_id);

create index if not exists idx_predictions_status
  on futurecast.predictions (status);

create index if not exists idx_predictions_source_predictor
  on futurecast.predictions (source_type, predictor_id);

create unique index if not exists idx_predictions_active_unique
  on futurecast.predictions (player_id, source_type, predictor_id)
  where status = 'ACTIVE';
