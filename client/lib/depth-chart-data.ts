/** Spring 2026 depth chart projections (ported from monolith). */

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
  { pos: 'QB', s: 'Tramell Jones Jr. / Aaron Philo', si: 'R-Fr. / R-So.', b: 'Aidan Warner', bi: 'R-Jr.', third: '', status: 'battle', analysis: 'Jones Jr. and Philo are in a dead heat entering fall camp. Warner provides veteran insurance as the QB3.' },
  { pos: 'RB', s: 'Jadan Baugh', si: 'Jr.', b: 'Duke Clark', bi: 'R-Fr.', third: 'Evan Pryor (R-Sr.) / Byron Louis (R-Fr.)', status: 'locked', analysis: 'Baugh is the clear starter and workhorse.' },
  { pos: 'WR (X)', s: 'Dallas Wilson', si: 'R-Fr.', b: 'Micah Mays', bi: 'R-Jr.', third: 'Kahleil Jackson (R-Sr.)', status: 'locked', analysis: 'Wilson leads at X after spring practice reps.' },
  { pos: 'WR (Z)', s: 'Eric Singleton Jr.', si: 'Sr.', b: 'TJ Abrams', bi: 'R-So.', third: 'Jaylen Lloyd (R-Jr.)', status: 'locked', analysis: 'Singleton Jr. is the clear #1 option.' },
  { pos: 'WR (F)', s: 'Vernell Brown III', si: 'So.', b: 'Bailey Stockton', bi: 'R-Jr.', third: 'Justin Williams (Fr.)', status: 'locked', analysis: 'VB3 at the F receiver position.' },
  { pos: 'TE (Y)', s: 'Lacota Dippre', si: 'R-Jr.', b: 'Evan Chieca', bi: 'R-Jr.', third: 'Heze Kent (Fr.)', status: 'locked', analysis: 'Dippre is the top TE.' },
  { pos: 'TE (H)', s: 'Amir Jackson', si: 'R-So.', b: 'Luke Harpring', bi: 'R-So.', third: 'Micah Jones (R-Fr.)', status: 'locked', analysis: 'Jackson leads at the H-back TE spot.' },
  { pos: 'LT', s: 'Emeka Ugorji', si: 'So.', b: 'Tavaris Dice', bi: 'R-Fr.', third: 'Tyler Chukuyem (Fr.)', status: 'locked', analysis: 'Ugorji wins the LT job.' },
  { pos: 'LG', s: 'Knijeah Harris', si: 'Sr.', b: "G'Nivre Carr", bi: 'Fr.', third: 'Corey Brown (Fr.)', status: 'locked', analysis: 'Harris anchors the interior.' },
  { pos: 'C', s: 'Harrison Moore', si: 'Jr.', b: 'Jason Zandamela', bi: 'R-So.', third: 'Mark Faircloth (R-So.)', status: 'locked', analysis: 'Moore runs the interior line.' },
  { pos: 'RG', s: 'Bryce Lovett / TJ Shanahan', si: 'R-Jr. / R-Jr.', b: 'Roderick Kearney', bi: 'R-Jr.', third: 'Desmond Green (Fr.)', status: 'battle', analysis: 'A real battle at RG between Lovett and Shanahan.' },
  { pos: 'RT', s: 'Caden Jones', si: 'R-So.', b: 'Eagan Boyer', bi: 'R-So.', third: 'Javarii Luckas (Fr.)', status: 'locked', analysis: 'Jones holds the starting RT spot.' },
];

export const DEPTH_CHART_DEF: DepthChartRow[] = [
  { pos: 'DT', s: 'Jeremiah McCloud', si: 'So.', b: 'Jamari Lyons / Joseph Mbatchou', bi: 'R-Sr. / So.', third: 'Mason Clinton (R-Jr.)', status: 'locked', analysis: 'McCloud steps into the starting DT role.' },
  { pos: 'NOSE', s: 'Brendan Bett', si: 'R-Jr.', b: 'DK Kalu', bi: 'R-Jr.', third: 'Joseph Mbatchou (So.)', status: 'locked', analysis: 'Bett anchors the nose.' },
  { pos: 'END', s: 'LJ McCray', si: 'R-So.', b: 'Kamran James / Emmanuel Oyebadejo', bi: 'Sr. / R-Sr.', third: 'JaReylan McCoy (Fr.)', status: 'locked', analysis: 'McCray leads the END spot.' },
  { pos: 'JACK', s: 'Jayden Woods', si: 'So.', b: 'Kevin Ford', bi: 'Fr.', third: 'Kofi Asare (R-Sr.)', status: 'locked', analysis: 'Jayden Woods is the best player on this defense.' },
  { pos: 'MIKE', s: 'Jaden Robinson', si: 'Sr.', b: 'Myles Johnson', bi: 'So.', third: 'Evan Jackson (R-So.)', status: 'locked', analysis: 'Robinson is the field general.' },
  { pos: 'WILL', s: 'Myles Graham', si: 'Jr.', b: 'Ty Jackson', bi: 'So.', third: 'TJ Bullard (R-Sr.)', status: 'locked', analysis: 'Graham is a speed/instincts linebacker.' },
  { pos: 'SAM', s: 'Aaron Chiles', si: 'Jr.', b: 'Malik Morris', bi: 'Fr.', third: 'Matthew Kade (R-So.)', status: 'locked', analysis: 'Chiles leads the SAM spot.' },
  { pos: 'CB', s: 'Dijon Johnson', si: 'R-Jr.', b: "J'Vari Flowers", bi: 'So.', third: 'Jordy Lowery (R-Sr.)', status: 'locked', analysis: 'Johnson is a physical press-man corner.' },
  { pos: 'CB', s: 'Cormani McClain', si: 'R-So.', b: 'Ben Hanks III', bi: 'So.', third: 'Onis Konanbanny (R-Fr.)', status: 'locked', analysis: 'McClain locks down his side of the field.' },
  { pos: 'STAR', s: 'Kanye Clark', si: 'R-So.', b: 'DJ Coleman', bi: 'Sr.', third: 'Elijah Owens (So.)', status: 'locked', analysis: 'Clark is the starting STAR/nickel.' },
  { pos: 'SS', s: 'Bryce Thornton', si: 'Sr.', b: 'Lagonza Hayward', bi: 'So.', third: 'Drake Stubbs (So.)', status: 'locked', analysis: 'Thornton is the physical enforcer at strong safety.' },
  { pos: 'FS', s: 'Cam Dooley', si: 'Jr.', b: 'DJ Coleman', bi: 'Sr.', third: 'Alfonso Allen Jr. (Sr.)', status: 'locked', analysis: 'Dooley projects as the starting free safety.' },
];

export const DEPTH_CHART_ST: DepthChartRow[] = [
  { pos: 'PR', s: 'Vernell Brown III', si: 'So.', b: 'Bailey Stockton', bi: 'R-Jr.', third: 'Jaylen Lloyd (R-Jr.)', status: 'locked', analysis: 'Brown III is the top punt return option.' },
  { pos: 'KR', s: 'Vernell Brown III', si: 'So.', b: 'London Montgomery', bi: 'R-Jr.', third: 'Evan Pryor (R-Sr.)', status: 'locked', analysis: 'Brown III doubles as kick returner.' },
  { pos: 'K', s: 'Patrick Durkin', si: 'R-So.', b: 'Brandon Rabasco', bi: 'R-So.', third: 'Liam Padron (R-So.)', status: 'locked', analysis: 'Durkin won the job in spring.' },
  { pos: 'P', s: 'Alec Clark', si: 'R-Jr.', b: 'Miller Fealy', bi: 'So.', third: 'Nicholas Inglis (R-So.)', status: 'locked', analysis: 'Clark is a proven punter.' },
  { pos: 'LS', s: 'Carter Milliron', si: 'R-Sr.', b: 'Hunter Solwold', bi: 'R-Fr.', third: '', status: 'locked', analysis: 'Veteran long snapper.' },
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
