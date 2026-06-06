-- GatorVault Recruiting — run in Supabase SQL Editor (Phase 1+)
-- Enable Realtime on players + recruiting_events after deploy.

create extension if not exists "pgcrypto";

create table if not exists class_rankings (
  class_year smallint primary key,
  national_rank smallint,
  sec_rank smallint,
  class_score numeric(5,2),
  source text default 'on3',
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  pos text not null,
  class_year smallint,
  school text,
  ht_wt text,
  stars smallint,
  rating numeric(5,2),
  natl_rank int,
  pos_rank int,
  state_rank int,
  in_state boolean default false,
  category text not null default 'recruit' check (category in ('recruit', 'portal', 'target')),
  status text not null default 'committed' check (status in (
    'target', 'committed', 'enrolled', 'decommitted', 'flipped', 'portal_in', 'portal_out'
  )),
  committed_to text default 'Florida',
  from_school text,
  commit_date date,
  skinny text,
  profile_note text,
  on3_id text,
  stars_display text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_class_year_idx on players (class_year);
create index if not exists players_category_idx on players (category);
create index if not exists players_status_idx on players (status);
create index if not exists players_slug_idx on players (slug);

create table if not exists recruiting_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete set null,
  player_slug text not null,
  event_type text not null check (event_type in (
    'commit', 'decommit', 'flip', 'portal_in', 'portal_out', 'ranking_change', 'target_update'
  )),
  title text not null,
  detail text,
  skinny text,
  class_year smallint,
  payload jsonb default '{}'::jsonb,
  source text default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists recruiting_events_created_idx on recruiting_events (created_at desc);
create index if not exists recruiting_events_slug_idx on recruiting_events (player_slug);

-- Auto-update players.updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists players_updated_at on players;
create trigger players_updated_at
  before update on players
  for each row execute function set_updated_at();
