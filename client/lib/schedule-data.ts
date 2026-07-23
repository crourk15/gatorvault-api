/** 2026 Florida schedule — official week order (SEC + non-conference). */

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
  /** Explicit projected score — prefer over parsing `pred`. */
  predUF: number;
  predOpp: number;
  /** Verified Film Room opponent-prep lesson id (knowledge engine). */
  filmLessonId?: string;
  opponentTendencies?: string[];
  howUFWins?: string[];
  scoutingReport?: string;
};

export const SCHEDULE_GAMES: ScheduleGame[] = [
  {
    id: 'fau',
    label: 'Sep 5 vs FAU',
    opp: 'FAU Owls',
    date: 'September 5, 2026 · 7:45 PM ET',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 94,
    tv: 'SEC Network',
    keys: ['Establish run with Baugh early', 'QB1: no turnovers in debut', 'Defense sets physical tone'],
    swing: [
      { name: 'Jones Jr. / Philo', role: 'Efficiency matters in debut' },
      { name: 'Jayden Woods', role: 'JACK sets the edge' },
    ],
    film: 'FAU runs spread RPO. The 3-3-5 is built to neutralize this.',
    pred: 'UF 38 · FAU 10',
    predUF: 38,
    predOpp: 10,
    filmLessonId: 'frl00004-0000-4000-8000-000000000004',
    opponentTendencies: ['Spread-RPO quick game at tempo', 'Tests STAR communication and edge setting', 'Limited vertical threat — win early downs'],
    howUFWins: ['Faulkner establishes rhythm RPO without negative plays', 'White front sets edge vs conflict reads', 'Win field position and avoid special teams mistakes'],
    scoutingReport:
      "FAU spreads the field and operates quickly. UF's odd front and STAR fit are built for this opener — control explosives and force long drives.",
  },
  {
    id: 'campbell',
    label: 'Sep 12 vs Campbell',
    opp: 'Campbell Camels',
    date: 'September 12, 2026 · 5:30 PM ET',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 96,
    tv: 'SEC Network',
    keys: ['Control tempo and field position', 'Evaluate depth in second half', 'Clean special teams'],
    swing: [
      { name: 'Eric Singleton Jr.', role: 'Vertical threat' },
      { name: 'Jaden Baugh', role: 'Run-game rhythm' },
    ],
    film: 'Campbell runs spread concepts. UF should win line of scrimmage.',
    pred: 'UF 45 · Campbell 10',
    predUF: 45,
    predOpp: 10,
  },
  {
    id: 'auburn',
    label: 'Sep 19 @ Auburn',
    opp: 'Auburn Tigers',
    date: 'September 19, 2026 · 7:00 PM ET',
    venue: 'Jordan-Hare Stadium',
    ufPct: 52,
    tv: 'ESPN',
    keys: ['Control LOS', 'Limit explosive plays', 'Win 3rd down'],
    swing: [
      { name: 'Singleton Jr.', role: 'First road SEC test' },
      { name: 'Cormani McClain', role: 'Neutralize their #1 WR' },
    ],
    film: 'Auburn runs physical downhill ball. Jordan-Hare in September is tough.',
    pred: 'UF 24 · Auburn 21',
    predUF: 24,
    predOpp: 21,
    filmLessonId: 'frl00005-0000-4000-8000-000000000005',
    opponentTendencies: ['Gap-scheme downhill run game', 'Physical at the point of attack', 'Play-action off run success'],
    howUFWins: ['Trautwein OL wins line of scrimmage', 'Gasparato linebackers fit gaps cleanly', 'Avoid negative plays on the road'],
    scoutingReport:
      'Auburn wants to control the clock with power run. UF must win early downs and limit explosives in a hostile environment.',
  },
  {
    id: 'olemiss',
    label: 'Sep 26 vs Ole Miss',
    opp: 'Ole Miss Rebels',
    date: 'September 26, 2026 · TBA',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 48,
    keys: ['Match their tempo without mistakes', 'Pressure their QB', 'Win early downs'],
    swing: [
      { name: 'Jayden Woods', role: 'Edge pressure' },
      { name: 'QB1', role: 'Avoid negative plays' },
    ],
    film: 'Ole Miss tempo offense stresses communication.',
    pred: 'UF 31 · Ole Miss 28',
    predUF: 31,
    predOpp: 28,
  },
  {
    id: 'missouri',
    label: 'Oct 3 @ Missouri',
    opp: 'Missouri Tigers',
    date: 'October 3, 2026 · TBA',
    venue: 'Memorial Stadium, Columbia MO',
    ufPct: 55,
    keys: ['Establish run on road', 'Win turnover battle', 'Execute red zone'],
    swing: [
      { name: 'Jaden Baugh', role: 'Physical run game' },
      { name: 'Secondary', role: 'Limit deep shots' },
    ],
    film: 'Missouri uses RPO and play-action.',
    pred: 'UF 27 · Missouri 24',
    predUF: 27,
    predOpp: 24,
  },
  {
    id: 'scar',
    label: 'Oct 10 vs South Carolina',
    opp: 'South Carolina Gamecocks',
    date: 'October 10, 2026 · TBA',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 58,
    keys: ['Win rivalry week', 'Control clock', 'Limit their QB run game'],
    swing: [
      { name: 'Edge defenders', role: 'Contain QB run' },
      { name: 'Singleton Jr.', role: 'Win one-on-ones' },
    ],
    film: 'South Carolina RPO-heavy.',
    pred: 'UF 30 · South Carolina 23',
    predUF: 30,
    predOpp: 23,
  },
  {
    id: 'texas',
    label: 'Oct 17 @ Texas',
    opp: 'Texas Longhorns',
    date: 'October 17, 2026 · TBA',
    venue: 'DKR-Texas Memorial Stadium',
    ufPct: 44,
    keys: ['Protect the football', 'Win early downs', 'Limit explosives'],
    swing: [
      { name: 'QB1', role: 'Decision-making vs pressure' },
      { name: 'OL', role: 'Road pass protection' },
    ],
    film: 'Texas balanced attack with elite skill.',
    pred: 'UF 24 · Texas 27',
    predUF: 24,
    predOpp: 27,
  },
  {
    id: 'uga',
    label: 'Oct 31 vs Georgia',
    opp: 'Georgia Bulldogs',
    date: 'October 31, 2026 · 3:30 PM ET',
    venue: 'EverBank Stadium (Jacksonville)',
    ufPct: 41,
    tv: 'ABC',
    keys: ['Control time of possession', 'Get pressure on their QB', 'Establish run before going downfield'],
    swing: [
      { name: 'Jadan Baugh', role: 'Must go 100+ yards' },
      { name: 'Jayden Woods', role: 'Must generate pressure' },
    ],
    film: 'Georgia has owned this series. UF path is controlling the ball.',
    pred: 'UF 27 · Georgia 24',
    predUF: 27,
    predOpp: 24,
  },
  {
    id: 'kentucky',
    label: 'Nov 14 vs Kentucky',
    opp: 'Kentucky Wildcats',
    date: 'November 14, 2026 · TBA',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 62,
    keys: ['Physical run fits', 'Win the trenches', 'Finish in red zone'],
    swing: [
      { name: 'Jaden Baugh', role: 'Wear down front' },
      { name: 'WR room', role: 'Explosive plays' },
    ],
    film: 'Kentucky power run and play-action.',
    pred: 'UF 31 · Kentucky 20',
    predUF: 31,
    predOpp: 20,
  },
  {
    id: 'vandy',
    label: 'Nov 21 vs Vanderbilt',
    opp: 'Vanderbilt Commodores',
    date: 'November 21, 2026 · TBA',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 78,
    keys: ['Execute early', 'Avoid complacency', 'Develop depth'],
    swing: [
      { name: 'Backup units', role: 'Rep evaluation' },
      { name: 'QB1', role: 'Efficient scoring drives' },
    ],
    film: 'Vanderbilt improving — treat as SEC test.',
    pred: 'UF 35 · Vanderbilt 17',
    predUF: 35,
    predOpp: 17,
  },
  {
    id: 'fsu',
    label: 'Nov 27 @ FSU',
    opp: 'Florida State Seminoles',
    date: 'November 27, 2026 · TBA',
    venue: 'Doak Campbell Stadium',
    ufPct: 48,
    keys: ['Win field position battle', 'Avoid penalties', 'Win turnover margin'],
    swing: [
      { name: 'QB1', role: 'Composure in hostile environment' },
      { name: 'Myles Graham', role: 'Contain their TE weapon' },
    ],
    film: 'Everything on the line. Preparation wins this game.',
    pred: 'UF 31 · FSU 28',
    predUF: 31,
    predOpp: 28,
    filmLessonId: 'frl00010-0000-4000-8000-00000000000a',
    opponentTendencies: ['RPO and quick game in rivalry setting', 'TE usage in red zone', 'Tempo spikes in critical moments'],
    howUFWins: ['Faulkner wins early downs without turnovers', 'White coverage matches sim pressure looks', 'Special teams and field position decide it'],
    scoutingReport:
      "Rivalry game at Doak — field position and turnover margin decide it. UF's 3-3-5 is built to handle spread RPO; offense must finish drives.",
  },
];
