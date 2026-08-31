/** Fall camp depth chart fallback — live board is `/api/roster/depth-chart`. */

export type DepthChartStatus = 'locked' | 'battle' | 'watch';

export type DepthChartRow = {
  pos: string;
  s: string;
  si: string;
  b: string;
  bi: string;
  third?: string;
  status: DepthChartStatus;
  analysis: string;
};

export type DepthPhase = 'off' | 'def' | 'st';

export const DEPTH_CHART_OFF: DepthChartRow[] = [
  { pos: 'QB', s: 'Aaron Philo', si: 'Jr.', b: 'Tramell Jones Jr.', bi: 'So.', third: '', status: 'locked', analysis: 'Official Week 1 chart: Philo starts vs FAU. Tramell is the listed backup. Will Griffin is not on the two-deep.' },
  { pos: 'RB', s: 'Jadan Baugh', si: 'Jr.', b: 'Evan Pryor / Duke Clark', bi: '6th / So.', third: 'London Montgomery (Sr.) / Byron Louis (So.)', status: 'locked', analysis: 'Baugh is RB1. Pryor and Clark are next; Montgomery and Louis share the fourth tier (OR on the official sheet).' },
  { pos: 'WR (X)', s: 'Dallas Wilson', si: 'So.', b: 'Micah Mays Jr. / Kahleil Jackson', bi: 'Sr. / 7th', third: '', status: 'locked', analysis: 'Wilson starts at X. Mays Jr. and Kahleil are listed as the OR behind him.' },
  { pos: 'WR (Z)', s: 'Eric Singleton Jr.', si: 'Sr.', b: 'TJ Abrams', bi: 'Jr.', third: '', status: 'locked', analysis: 'Singleton Jr. starts at Z with Abrams next.' },
  { pos: 'WR (F)', s: 'Vernell Brown III', si: 'So.', b: 'Bailey Stockton', bi: 'Sr.', third: '', status: 'locked', analysis: 'VB3 holds the F with Stockton behind him (also the PR two-deep).' },
  { pos: 'TE (Y)', s: 'Lacota Dippre', si: 'Sr.', b: 'Heze Kent', bi: 'Fr.', third: '', status: 'locked', analysis: 'Dippre is the Y starter. Kent is the listed backup — Sumrall flagged him as one of the most improved freshmen.' },
  { pos: 'TE (H)', s: 'Amir Jackson / Luke Harpring', si: 'Jr. / Jr.', b: '', bi: '', third: '', status: 'battle', analysis: 'Official co-starters at H (OR). Jackson listed first; Harpring shares the first team.' },
  { pos: 'LT', s: 'Bryce Lovett', si: 'Sr.', b: 'Eagan Boyer', bi: 'Jr.', third: '', status: 'locked', analysis: 'Lovett starts at LT; Boyer is the backup.' },
  { pos: 'LG', s: 'Knijeah Harris', si: 'Sr.', b: 'Roderick Kearney', bi: 'Sr.', third: '', status: 'locked', analysis: 'Harris at left guard; Kearney next.' },
  { pos: 'C', s: 'Harrison Moore', si: 'Jr.', b: 'Jason Zandamela', bi: 'Jr.', third: '', status: 'locked', analysis: 'Moore at center; Zandamela is the backup.' },
  { pos: 'RG', s: 'TJ Shanahan Jr.', si: 'Sr.', b: 'TJ Dice Jr.', bi: 'So.', third: '', status: 'locked', analysis: 'Shanahan at right guard. Dice Jr. is the official backup (not Pierre Louis).' },
  { pos: 'RT', s: 'Emeka Ugorji', si: 'Sr.', b: 'Caden Jones', bi: 'Sr.', third: '', status: 'locked', analysis: 'Ugorji starts at RT; Caden Jones is next.' },
];

export const DEPTH_CHART_DEF: DepthChartRow[] = [
  { pos: 'END', s: 'Kamran James / LJ McCray / Emmanuel Oyebadejo', si: 'Sr. / Jr. / 5th', b: '', bi: '', third: '', status: 'battle', analysis: 'Three-way OR at defensive end on the official sheet — all listed first team.' },
  { pos: 'NOSE', s: 'Brendan Bett', si: 'Sr.', b: 'Joseph Mbatchou', bi: 'So.', third: '', status: 'locked', analysis: 'Bett starts at nose; Mbatchou is the backup.' },
  { pos: 'DT', s: 'Jeramiah McCloud', si: 'So.', b: 'DK Kalu / Jamari Lyons', bi: 'Sr. / 5th', third: '', status: 'locked', analysis: 'McCloud starts at DT. Kalu and Lyons are the OR behind him.' },
  { pos: 'JACK', s: 'Jayden Woods', si: 'So.', b: 'Kofi Asare / KJ Ford', bi: '5th / Fr.', third: '', status: 'locked', analysis: 'Woods starts at JACK. Asare and Ford share the next tier (OR).' },
  { pos: 'WILL', s: 'Myles Graham', si: 'Jr.', b: 'Myles Johnson', bi: 'So.', third: '', status: 'locked', analysis: 'Graham starts; Myles Johnson is the listed backup.' },
  { pos: 'SAM', s: 'Aaron Chiles', si: 'Jr.', b: 'Ty Jackson', bi: 'So.', third: '', status: 'locked', analysis: 'Chiles starts; Ty Jackson is next.' },
  { pos: 'MIKE', s: 'Jaden Robinson', si: 'Sr.', b: 'TJ Bullard', bi: '5th', third: '', status: 'locked', analysis: 'Robinson starts in the middle; Bullard is the backup.' },
  { pos: 'STAR', s: 'Kanye Clark', si: 'Sr.', b: 'Alfonzo Allen Jr.', bi: '5th', third: '', status: 'locked', analysis: 'Clark starts at STAR; Allen Jr. is behind him.' },
  { pos: 'CB', s: 'Ben Hanks III', si: 'So.', b: 'Dijon Johnson', bi: 'Sr.', third: '', status: 'locked', analysis: 'Hanks starts on one side; Dijon is the backup.' },
  { pos: 'CB', s: 'Cormani McClain', si: 'Sr.', b: "J'Vari Flowers", bi: 'So.', third: '', status: 'battle', analysis: 'Official OR at the other corner — McClain and Flowers share the first team.' },
  { pos: 'SS', s: 'Bryce Thornton', si: 'Sr.', b: 'Cam Dooley', bi: 'Jr.', third: '', status: 'locked', analysis: 'Thornton starts; Dooley is the backup.' },
  { pos: 'FS', s: 'DJ Coleman', si: 'Sr.', b: 'Lagonza Hayward', bi: 'So.', third: '', status: 'locked', analysis: 'Coleman starts at free safety; Hayward is next.' },
];

export const DEPTH_CHART_ST: DepthChartRow[] = [
  { pos: 'PR', s: 'Vernell Brown III', si: 'So.', b: 'Bailey Stockton', bi: 'Sr.', third: '', status: 'locked', analysis: 'Official PR two-deep: Brown III, then Stockton.' },
  { pos: 'KR', s: 'London Montgomery', si: 'Sr.', b: "J'Vari Flowers", bi: 'So.', third: '', status: 'locked', analysis: 'Montgomery leads kick return; Flowers is next.' },
  { pos: 'K', s: 'Patrick Durkin', si: 'Jr.', b: 'Liam Padron', bi: 'Jr.', third: '', status: 'locked', analysis: 'Durkin is the placekicker; Padron is the backup. Durkin also handles kickoffs.' },
  { pos: 'KO', s: 'Patrick Durkin', si: 'Jr.', b: 'Brandon Rabasco', bi: 'Jr.', third: '', status: 'locked', analysis: 'Durkin on kickoffs; Rabasco is the backup.' },
  { pos: 'P', s: 'Alec Clark', si: 'Sr.', b: 'Nicholas Inglis', bi: 'Jr.', third: '', status: 'locked', analysis: 'Clark punts (and holds); Inglis is next.' },
  { pos: 'LS', s: 'Carter Milliron', si: '5th', b: 'Lincoln Anderson', bi: 'Fr.', third: '', status: 'locked', analysis: 'Milliron on long snaps; Anderson is the backup (and short-snapper first).' },
];

export const DEPTH_BY_PHASE: Record<DepthPhase, DepthChartRow[]> = {
  off: DEPTH_CHART_OFF,
  def: DEPTH_CHART_DEF,
  st: DEPTH_CHART_ST,
};

export const DEPTH_PHASE_LABELS: Record<DepthPhase, string> = {
  off: '⚔️ Offense',
  def: '🛡️ Defense 3-3-5',
  st: '⚡ Special Teams',
};
