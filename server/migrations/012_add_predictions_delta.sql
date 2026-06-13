-- FutureCast — confidence delta on predictions (trending indicator)
-- @see client/components/futurecast/TrendingIndicator.tsx

alter table futurecast.predictions
  add column if not exists delta int not null default 0;
