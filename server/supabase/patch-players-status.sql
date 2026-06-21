-- Expand players.status to match recruiting-store values (uncommitted, signed).
alter table players drop constraint if exists players_status_check;
alter table players add constraint players_status_check check (status in (
  'target', 'uncommitted', 'committed', 'enrolled', 'signed', 'decommitted', 'flipped', 'portal_in', 'portal_out'
));
