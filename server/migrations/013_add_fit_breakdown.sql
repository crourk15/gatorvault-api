-- FutureCast — UF fit breakdown columns on players
-- @see client/components/player/FitScoreBreakdown.tsx

alter table futurecast.players
  add column if not exists fit_scheme int not null default 0,
  add column if not exists fit_culture int not null default 0,
  add column if not exists fit_staff int not null default 0,
  add column if not exists fit_need int not null default 0,
  add column if not exists fit_geo int not null default 0;
