/** 2026 depth chart projections — refreshed with July OTA / summer workout intel. */

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
  { pos: 'QB', s: 'Tramell Jones Jr. / Aaron Philo', si: 'R-Fr. / R-So.', b: 'Aidan Warner', bi: 'R-Jr.', third: '', status: 'battle', analysis: 'Dead heat into Aug. 5 camp. Philo (Faulkner GT carryover) has been mentoring Jones on scheme despite the competition.' },
  { pos: 'RB', s: 'Jadan Baugh', si: 'Jr.', b: 'Duke Clark', bi: 'R-Fr.', third: 'Evan Pryor (R-Sr.) / Byron Louis (R-Fr.)', status: 'locked', analysis: 'Baugh is the clear starter and workhorse.' },
  { pos: 'WR (X)', s: 'Dallas Wilson', si: 'R-Fr.', b: 'Micah Mays', bi: 'R-Jr.', third: 'Kahleil Jackson (R-Sr.)', status: 'locked', analysis: 'Wilson is back from a spring foot issue and impressed in OTAs — part of an elite Brown/Singleton/Wilson trio.' },
  { pos: 'WR (Z)', s: 'Eric Singleton Jr.', si: 'Sr.', b: 'TJ Abrams', bi: 'R-So.', third: 'Jaylen Lloyd (R-Jr.)', status: 'locked', analysis: 'Singleton Jr. is the clear WR1 and vertical hammer in a loaded room.' },
  { pos: 'WR (F)', s: 'Vernell Brown III', si: 'So.', b: 'Bailey Stockton', bi: 'R-Jr.', third: 'Justin Williams (Fr.)', status: 'locked', analysis: 'VB3 holds the F; Stockton has been balling in OTAs as the slot factor beside him.' },
  { pos: 'TE (Y)', s: 'Lacota Dippre', si: 'R-Jr.', b: 'Evan Chieca', bi: 'R-Jr.', third: 'Heze Kent (Fr.)', status: 'locked', analysis: 'Dippre is the top TE.' },
  { pos: 'TE (H)', s: 'Amir Jackson', si: 'R-So.', b: 'Luke Harpring', bi: 'R-So.', third: 'Micah Jones (R-Fr.)', status: 'locked', analysis: 'Jackson leads at H; Harpring adds Faulkner GT scheme familiarity.' },
  { pos: 'LT', s: 'Emeka Ugorji', si: 'So.', b: 'Tavaris Dice', bi: 'R-Fr.', third: 'Tyler Chukuyem (Fr.)', status: 'locked', analysis: 'Ugorji wins the LT job.' },
  { pos: 'LG', s: 'Knijeah Harris', si: 'Sr.', b: "G'Nivre Carr", bi: 'Fr.', third: 'Corey Brown (Fr.)', status: 'locked', analysis: 'Harris anchors the interior.' },
  { pos: 'C', s: 'Harrison Moore', si: 'Jr.', b: 'Jason Zandamela', bi: 'R-So.', third: 'Mark Faircloth (R-So.)', status: 'locked', analysis: 'July OTA standout — Faulkner carryover and blue-collar leader of the OL room.' },
  { pos: 'RG', s: 'Bryce Lovett / TJ Shanahan', si: 'R-Jr. / R-Jr.', b: 'Roderick Kearney', bi: 'R-Jr.', third: 'Desmond Green (Fr.)', status: 'battle', analysis: 'Still a battle. Shanahan is the most physical OL and a summer standout; Lovett is thriving and in the mix. Kearney also PR\'d in the weight room.' },
  { pos: 'RT', s: 'Caden Jones', si: 'R-So.', b: 'Eagan Boyer', bi: 'R-So.', third: 'Javarii Luckas (Fr.)', status: 'locked', analysis: 'Jones holds the starting RT spot.' },
];

export const DEPTH_CHART_DEF: DepthChartRow[] = [
  { pos: 'DT', s: 'Jeramiah McCloud', si: 'So.', b: 'Jamari Lyons / Joseph Mbatchou', bi: 'R-Sr. / So.', third: 'Mason Clinton (R-Jr.)', status: 'battle', analysis: 'McCloud flashed in OTAs and the weight room (400+ Zercher) while battling for a starting DT role.' },
  { pos: 'NOSE', s: 'Brendan Bett', si: 'R-Jr.', b: 'DK Kalu', bi: 'R-Jr.', third: 'Joseph Mbatchou (So.)', status: 'locked', analysis: 'Bett steadied the nose after Boireau; Kalu and a +20-lb Mbatchou add needed depth.' },
  { pos: 'END', s: 'LJ McCray', si: 'R-So.', b: 'Kamran James / Emmanuel Oyebadejo', bi: 'Sr. / R-Sr.', third: 'JaReylan McCoy (Fr.)', status: 'battle', analysis: 'McCray had a standout summer (400+ pause squat, 315 clean) and is vying for a starting role.' },
  { pos: 'JACK', s: 'Jayden Woods', si: 'So.', b: 'Kevin Ford', bi: 'Fr.', third: 'Kofi Asare (R-Sr.)', status: 'locked', analysis: 'Jayden Woods is the best player on this defense.' },
  { pos: 'MIKE', s: 'Jaden Robinson', si: 'Sr.', b: 'Myles Johnson', bi: 'So.', third: 'Evan Jackson (R-So.)', status: 'locked', analysis: 'Robinson is the field general.' },
  { pos: 'WILL', s: 'Myles Graham', si: 'Jr.', b: 'Ty Jackson', bi: 'So.', third: 'TJ Bullard (R-Sr.)', status: 'locked', analysis: 'Graham is a speed/instincts linebacker.' },
  { pos: 'SAM', s: 'Aaron Chiles', si: 'Jr.', b: 'Malik Morris', bi: 'Fr.', third: 'Matthew Kade (R-So.)', status: 'locked', analysis: 'Chiles leads the SAM spot.' },
  { pos: 'CB', s: 'Dijon Johnson', si: 'R-Jr.', b: "J'Vari Flowers", bi: 'So.', third: 'Jordy Lowery (R-Sr.)', status: 'battle', analysis: 'Johnson was limited in spring; Hanks took 1s reps in his absence — camp will re-sort the room.' },
  { pos: 'CB', s: 'Cormani McClain', si: 'R-So.', b: 'Ben Hanks III', bi: 'So.', third: 'Onis Konanbanny (R-Fr.)', status: 'locked', analysis: 'Sumrall has personally developed McClain this offseason (300-lb clean). More physical now with the same lockdown coverage.' },
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
