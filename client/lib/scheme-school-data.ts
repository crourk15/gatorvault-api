/**
 * Scheme School — fan-friendly UF football education (staff-accurate, no clinic jargon).
 * Staff labels must match floridagators.com / server/data/coaching-staff.json (2026 Sumrall staff).
 */

export type SchemeSchoolUnit = 'offense' | 'defense' | 'performance';

export type SchemeSchoolLesson = {
  id: string;
  title: string;
  unit: SchemeSchoolUnit;
  staff: string;
  dek: string;
  body: string;
  watchFor: string[];
  usageNote?: string;
};

export const SCHEME_SCHOOL_LESSONS: SchemeSchoolLesson[] = [
  {
    id: 'ss-rpo-quick',
    title: 'RPO Quick Game',
    unit: 'offense',
    staff: 'Buster Faulkner — OC',
    dek: 'Packaged run/pass reads that stress conflict defenders.',
    body: 'Under Faulkner, Florida runs rhythm RPO quick game — the QB reads a conflict defender (often a linebacker or safety) and either hands off or throws the quick route before pressure arrives. It keeps defenses honest and lets UF stay on schedule without forcing vertical shots every play.',
    watchFor: [
      'Does the QB get the ball out before pressure?',
      'Is the conflict defender wrong every time?',
      'Quick game vs soft coverage — who wins?',
    ],
    usageNote: 'Primary early-down weapon in spread structure.',
  },
  {
    id: 'ss-mesh',
    title: 'Mesh Concept',
    unit: 'offense',
    staff: 'Buster Faulkner — OC · WR room (Davis + McKnight)',
    dek: 'Two shallow crossers designed to create natural picks in zone.',
    body: 'Mesh pairs crossing routes from opposite directions. The QB reads zone depth — if linebackers sink, the underneath crosser is free; if they stay shallow, the deeper crosser wins. UF spacing rules from Davis and McKnight keep crossers from colliding and create leverage vs man and zone.',
    watchFor: ['Timing between crossers', 'QB eyes on zone drop depth', 'WR spacing at the mesh point'],
  },
  {
    id: 'ss-gap-run',
    title: 'Gap Scheme Run',
    unit: 'offense',
    staff: 'Buster Faulkner — OC · OL (Phil Trautwein)',
    dek: 'Pullers, angles, and downhill physical identity.',
    body: 'Gap scheme assigns each lineman a specific hole with pulling guards or tackles creating extra gaps. UF uses it to set physical tone — especially in short yardage and red zone — and to complement the spread/RPO menu so defenses cannot sell out for one look.',
    watchFor: ['Puller timing and angle', 'Back-side cutback lanes', 'OL winning at the point of attack'],
  },
  {
    id: 'ss-pa-wide-zone',
    title: 'Play-Action Off Wide Zone',
    unit: 'offense',
    staff: 'Buster Faulkner — OC',
    dek: 'Sell the run, attack over the top.',
    body: 'Wide zone stretches the front horizontally; play-action off that look freezes linebackers and safeties. Faulkner sets this up when defenses load the box — the boot or deep shot becomes the payoff after establishing run looks.',
    watchFor: ['Linebacker freeze on run fake', 'Safety rotation depth', 'Vertical shots after run success'],
  },
  {
    id: 'ss-qb-progression',
    title: 'QB Progression Rules',
    unit: 'offense',
    staff: 'Joe Craddock — Quarterbacks',
    dek: 'Where the QB looks, and in what order.',
    body: 'Craddock trains progression reads — primary to checkdown — so the QB knows where the ball goes before the snap based on coverage. Clean footwork and timing keep UF out of negative plays and sacks when protection is stressed.',
    watchFor: ['Eyes through progression', 'Ball out on time vs pressure', 'Checkdown vs blitz'],
  },
  {
    id: 'ss-wr-spacing',
    title: 'WR Spacing Rules',
    unit: 'offense',
    staff: 'Marcus Davis + Trent McKnight — WR coaches',
    dek: 'How UF creates leverage with route spacing.',
    body: 'Davis and McKnight install spacing rules so routes do not bunch — each receiver owns a landmark. That creates conflict for defenders in zone and one-on-one chances in man, especially for Singleton Jr. and the vertical room.',
    watchFor: ['Landmark discipline', 'Separation at the break', 'Stack vs spread alignment'],
  },
  {
    id: 'ss-te-usage',
    title: 'TE Usage',
    unit: 'offense',
    staff: 'Evan McKissack — Tight Ends',
    dek: 'Seams, red zone, and inline blocking.',
    body: 'UF uses tight ends in seams vs zone, as extra protection in pass pro, and as red-zone targets when linebackers bite on run fakes. McKissack develops blockers and receivers who keep 12 personnel honest for Faulkner.',
    watchFor: ['Seam routes vs Cover 3', 'Red-zone target share', 'Inline blocks on edge runs'],
  },
  {
    id: 'ss-ol-technique',
    title: 'OL Technique',
    unit: 'offense',
    staff: 'Phil Trautwein — Offensive Line',
    dek: 'Pass protection and run fits up front.',
    body: 'Trautwein emphasizes pad level, hand placement, and communication on stunts. Rebuilt OL is the swing factor for downfield shots — if protection holds, Faulkner can run full progression and play-action packages.',
    watchFor: ['Pressure allowed vs sim looks', 'Combo blocks on gap runs', 'Communication on twists'],
  },
  {
    id: 'ss-odd-front',
    title: '3-Down Odd Front',
    unit: 'defense',
    staff: 'Brad White — DC',
    dek: 'Why UF plays three down linemen and five hybrid defenders.',
    body: "White's odd front puts three down linemen with hybrid JACK and STAR roles — five defenders who can rush, cover, or fit the run. It matches modern spread offenses without subbing out of base, and lets UF pressure from multiple angles.",
    watchFor: ['Front declaration pre-snap', 'Hybrid alignments (JACK/STAR)', 'Run fit vs 11 personnel spread'],
  },
  {
    id: 'ss-sim-pressure',
    title: 'Sim Pressures',
    unit: 'defense',
    staff: 'Brad White — DC',
    dek: 'Disguised rushers — who is really coming?',
    body: 'Simulated pressures show blitz looks but drop rushers into coverage — or vice versa. White triggers these from JACK and STAR to force quick throws and bad reads without giving free shots over the top.',
    watchFor: ['Late blitzer identification', 'Coverage match behind pressure', 'QB hurried throws'],
  },
  {
    id: 'ss-jack',
    title: 'JACK Role',
    unit: 'defense',
    staff: 'Bam Hardmon — Outside Linebackers',
    dek: 'Edge setting, pass rush, and contain.',
    body: "JACK is the scheme centerpiece — set the edge vs run, rush the passer, and contain mobile QBs. Hardmon develops length, burst, and block shedding for the spot in White's odd front.",
    watchFor: ['Edge set vs zone read', 'Pass-rush plan on third down', 'Contain vs scramble QBs'],
  },
  {
    id: 'ss-star',
    title: 'STAR Role',
    unit: 'defense',
    staff: 'Chris Collins — Safeties',
    dek: 'Hybrid slot coverage and run fits from depth.',
    body: 'STAR covers slot receivers and fits the run from depth in the 3-3-5 nickel. Tempo offenses test this spot first — communication with linebackers and safeties has to be clean or explosives follow.',
    watchFor: ['Slot matchups', 'Run fit from depth', 'Communication vs tempo'],
  },
  {
    id: 'ss-coverage-shells',
    title: 'Coverage Shells',
    unit: 'defense',
    staff: 'Brandon Harris + Chris Collins — DB coaches',
    dek: "Cover 3, quarters, and man — UF's coverage identity.",
    body: 'Harris and Collins install shell rules so safeties and corners know landmarks in Cover 3, quarters, and man match. White mixes shells to protect against vertical shots while keeping enough bodies in the box to stop the run.',
    watchFor: ['Pre-snap shell rotation', 'Deep third responsibility', 'Man technique on outside WRs'],
  },
  {
    id: 'ss-run-fits',
    title: 'Run Fits',
    unit: 'defense',
    staff: 'Greg Gasparato — Linebackers',
    dek: 'How UF stops the run inside-out.',
    body: 'Gasparato teaches gap-and-scrape fits — each linebacker owns a gap, scrapes to the ball, and stays square. Physical SEC fronts test this weekly; missed fits show up as explosive runs.',
    watchFor: ['Gap integrity on power run', 'Scrape to ball carrier', 'Missed tackles in second level'],
  },
  {
    id: 'ss-dl-technique',
    title: 'DL Technique',
    unit: 'defense',
    staff: 'Gerald Chatman — Assistant HC / Defensive Line',
    dek: 'Gap control and leverage at the line.',
    body: "Chatman emphasizes pad level, two-gap control at nose, and one-gap penetration on passing downs. The front sets the tone for White's pressure packages — no free movement inside means linebackers can run.",
    watchFor: ['Nose controlling double teams', 'Penetration on third down', 'Edge contain vs RPO'],
  },
  {
    id: 'ss-physical-identity',
    title: 'Physical Identity',
    unit: 'performance',
    staff: 'Rusty Whitt — Director of Football Performance',
    dek: 'How UF wins the fourth quarter.',
    body: "Whitt builds a physical identity — tempo in practice, finish every rep, outlast opponents in the second half. That supports Faulkner's gap runs and White's pressure volume when games get tight.",
    watchFor: ['Fourth-quarter run efficiency', 'Tackle rate late in games', 'Penalty discipline when tired'],
  },
  {
    id: 'ss-tempo',
    title: 'Tempo Philosophy',
    unit: 'performance',
    staff: 'Rusty Whitt · staff',
    dek: 'Practice pace that prepares for SEC tempo offenses.',
    body: 'UF practices at elevated tempo so defenders communicate under stress — mirroring what Ole Miss, Texas, and spread teams do on Saturdays. Conditioning is not separate from scheme; it is how the scheme holds up in November.',
    watchFor: ['Defensive substitution speed', 'Communication errors vs tempo', 'Late-game execution'],
  },
  {
    id: 'ss-conditioning',
    title: 'Conditioning Themes',
    unit: 'performance',
    staff: 'Rusty Whitt — Director of Football Performance',
    dek: 'What keeps the roster available and explosive.',
    body: "Year-round conditioning cycles peak for September openers and maintain through rivalry week. Whitt's themes — recover fast, compete every snap — align with Sumrall's standard for a physical SEC program.",
    watchFor: ['Injury availability through season', 'Explosive play rate by quarter', 'Special teams effort level'],
  },
];

export const SCHEME_SCHOOL_UNITS: { id: SchemeSchoolUnit; label: string }[] = [
  { id: 'offense', label: 'Offense — Faulkner' },
  { id: 'defense', label: 'Defense — White' },
  { id: 'performance', label: 'Performance — Whitt' },
];

export function schemeSchoolLesson(id: string): SchemeSchoolLesson | undefined {
  return SCHEME_SCHOOL_LESSONS.find((l) => l.id === id);
}
