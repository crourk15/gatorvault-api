/** 2026 schedule for Game Week (ported from monolith games array). */

export type ScheduleGame = {
  id: string;
  label: string;
  opp: string;
  date: string;
  venue: string;
  ufPct: number;
  tv?: string;
  keys: string[];
  swing: { name: string; role: string }[];
  film: string;
  pred: string;
};

export const SCHEDULE_GAMES: ScheduleGame[] = [
  { id: 'fau', label: 'Sep 5 vs FAU', opp: 'FAU Owls', date: 'September 5, 2026 · 7:45 PM ET', venue: 'Ben Hill Griffin Stadium', ufPct: 94, tv: 'SEC Network', keys: ['Establish run with Baugh early', 'QB1: no turnovers in debut', 'Defense sets physical tone'], swing: [{ name: 'Jones Jr. / Philo', role: 'Efficiency matters in debut' }, { name: 'Jayden Woods', role: 'JACK sets the edge' }], film: 'FAU runs spread RPO. The 3-3-5 is built to neutralize this.', pred: 'UF 38 · FAU 10' },
  { id: 'charlotte', label: 'Sep 12 vs Charlotte', opp: 'Charlotte 49ers', date: 'September 12, 2026 · 5:30 PM ET', venue: 'Ben Hill Griffin Stadium', ufPct: 93, tv: 'SEC Network', keys: ['Control tempo and field position', 'Evaluate depth in second half', 'Clean special teams'], swing: [{ name: 'Eric Singleton Jr.', role: 'Vertical threat' }, { name: 'Jaden Baugh', role: 'Run-game rhythm' }], film: 'Charlotte runs spread concepts. UF should win line of scrimmage.', pred: 'UF 42 · Charlotte 10' },
  { id: 'auburn', label: 'Sep 19 @ Auburn', opp: 'Auburn Tigers', date: 'September 19, 2026 · 7:00 PM ET', venue: 'Jordan-Hare Stadium', ufPct: 52, tv: 'ESPN', keys: ['Control LOS', 'Limit explosive plays', 'Win 3rd down'], swing: [{ name: 'Singleton Jr.', role: 'First road SEC test' }, { name: 'Cormani McClain', role: 'Neutralize their #1 WR' }], film: 'Auburn runs physical downhill ball. Jordan-Hare in September is tough.', pred: 'UF 24 · Auburn 21' },
  { id: 'olemiss', label: 'Oct 3 vs Ole Miss', opp: 'Ole Miss Rebels', date: 'October 3, 2026 · FLEX', venue: 'Ben Hill Griffin Stadium', ufPct: 48, keys: ['Match their tempo without mistakes', 'Pressure their QB', 'Win early downs'], swing: [{ name: 'Jayden Woods', role: 'Edge pressure' }, { name: 'QB1', role: 'Avoid negative plays' }], film: 'Ole Miss tempo offense stresses communication.', pred: 'UF 31 · Ole Miss 28' },
  { id: 'missouri', label: 'Oct 10 @ Missouri', opp: 'Missouri Tigers', date: 'October 10, 2026 · FLEX', venue: 'Memorial Stadium, Columbia MO', ufPct: 55, keys: ['Establish run on road', 'Win turnover battle', 'Execute red zone'], swing: [{ name: 'Jaden Baugh', role: 'Physical run game' }, { name: 'Secondary', role: 'Limit deep shots' }], film: 'Missouri uses RPO and play-action.', pred: 'UF 27 · Missouri 24' },
  { id: 'lsu', label: 'Oct 17 vs LSU', opp: 'LSU Tigers', date: 'October 17, 2026 · EARLY', venue: 'Ben Hill Griffin Stadium', ufPct: 46, tv: 'EARLY', keys: ['Set edge vs their run game', 'Win one-on-ones outside', 'Finish drives'], swing: [{ name: 'DL', role: 'Interior push' }, { name: 'Singleton Jr.', role: 'Separation vs press' }], film: 'LSU physical in the trenches.', pred: 'UF 28 · LSU 27' },
  { id: 'texas', label: 'Oct 24 @ Texas', opp: 'Texas Longhorns', date: 'October 24, 2026 · EARLY', venue: 'DKR-Texas Memorial Stadium', ufPct: 44, tv: 'EARLY', keys: ['Protect the football', 'Win early downs', 'Limit explosives'], swing: [{ name: 'QB1', role: 'Decision-making vs pressure' }, { name: 'OL', role: 'Road pass protection' }], film: 'Texas balanced attack with elite skill.', pred: 'UF 24 · Texas 27' },
  { id: 'uga', label: 'Oct 31 vs Georgia', opp: 'Georgia Bulldogs', date: 'October 31, 2026 · 3:30 PM ET', venue: 'EverBank Stadium (Jacksonville)', ufPct: 41, tv: 'ABC', keys: ['Control time of possession', 'Get pressure on their QB', 'Establish run before going downfield'], swing: [{ name: 'Jadan Baugh', role: 'Must go 100+ yards' }, { name: 'Jayden Woods', role: 'Must generate pressure' }], film: 'Georgia has owned this series. UF path is controlling the ball.', pred: 'UF 27 · Georgia 24' },
  { id: 'oklahoma', label: 'Nov 7 @ Oklahoma', opp: 'Oklahoma Sooners', date: 'November 7, 2026 · FLEX', venue: 'Gaylord Family Oklahoma Memorial Stadium', ufPct: 47, keys: ['Match their tempo', 'Tackle in space', 'Win third down'], swing: [{ name: 'STAR', role: 'Slot coverage' }, { name: 'Run game', role: 'Stay balanced' }], film: 'Oklahoma spread offense — assignment soundness is key.', pred: 'UF 30 · Oklahoma 28' },
  { id: 'kentucky', label: 'Nov 14 vs Kentucky', opp: 'Kentucky Wildcats', date: 'November 14, 2026 · NIGHT', venue: 'Ben Hill Griffin Stadium', ufPct: 62, tv: 'NIGHT', keys: ['Physical run fits', 'Win the trenches', 'Finish in red zone'], swing: [{ name: 'Jaden Baugh', role: 'Wear down front' }, { name: 'WR room', role: 'Explosive plays' }], film: 'Kentucky power run and play-action.', pred: 'UF 31 · Kentucky 20' },
  { id: 'vandy', label: 'Nov 21 @ Vanderbilt', opp: 'Vanderbilt Commodores', date: 'November 21, 2026 · EARLY', venue: 'FirstBank Stadium, Nashville TN', ufPct: 78, tv: 'EARLY', keys: ['Execute early', 'Avoid complacency', 'Develop depth'], swing: [{ name: 'Backup units', role: 'Rep evaluation' }, { name: 'QB1', role: 'Efficient scoring drives' }], film: 'Vanderbilt improving — treat as SEC road test.', pred: 'UF 35 · Vanderbilt 17' },
  { id: 'scar', label: 'Nov 28 vs South Carolina', opp: 'South Carolina Gamecocks', date: 'November 28, 2026 · 3:30 PM ET', venue: 'Ben Hill Griffin Stadium', ufPct: 58, tv: 'ABC', keys: ['Win rivalry week', 'Control clock', 'Limit their QB run game'], swing: [{ name: 'Edge defenders', role: 'Contain QB run' }, { name: 'Singleton Jr.', role: 'Win one-on-ones' }], film: 'South Carolina RPO-heavy.', pred: 'UF 30 · South Carolina 23' },
  { id: 'fsu', label: 'Dec 5 @ FSU', opp: 'Florida State Seminoles', date: 'December 5, 2026 · TBD', venue: 'Doak Campbell Stadium', ufPct: 48, keys: ['Win field position battle', 'Avoid penalties', 'Win turnover margin'], swing: [{ name: 'QB1', role: 'Composure in hostile environment' }, { name: 'Myles Graham', role: 'Contain their TE weapon' }], film: 'Everything on the line. Preparation wins this game.', pred: 'UF 31 · FSU 28' },
];
