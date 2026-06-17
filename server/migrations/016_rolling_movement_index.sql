-- Rolling 7-day movement window — optimize history lookups by date
-- prediction_history uses `date` (not created_at); see 014_add_prediction_history.sql

create index if not exists idx_prediction_history_rolling
  on futurecast.prediction_history (player_id, date desc);

create index if not exists idx_prediction_history_date
  on futurecast.prediction_history (date desc);
