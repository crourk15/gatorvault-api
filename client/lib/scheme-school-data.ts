/**
 * Scheme School — elite install board (staff-accurate, Saturday language).
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
  callSheet: string;
  whenUFUses: string;
  saturdayTell: string;
  whatWins: string;
  whatLoses: string;
  relatedIds: string[];
};

export const SCHEME_SCHOOL_LESSONS: SchemeSchoolLesson[] = [
  {
    id: 'ss-rpo-quick',
    title: 'RPO Quick Game',
    unit: 'offense',
    staff: 'Buster Faulkner — OC',
    dek: 'Give or throw before the second level can choose.',
    body:
      'Faulkner packages a run and a quick throw on the same snap. Philo reads one conflict defender — usually a linebacker or the overhang — and either gives to Baugh or gets the ball out on the glance, stick, or bubble before the rush arrives. Week 1 vs FAU lived here: no-huddle shotgun every snap, Baugh on first down, Brown and Stockton finishing drives when the box leaned in. It is how Florida stays on schedule without hunting a deep shot every play.',
    watchFor: [
      'Is the ball out before the first rusher wins?',
      'Does the conflict defender lose both the run and the throw?',
      'When they load the box, does the glance or bubble hit now?',
    ],
    usageNote: 'Early-down answer in shotgun.',
    callSheet: 'RPO glance / stick / bubble off the zone or gap look.',
    whenUFUses: '1st and 2nd down when the box is light or the overhang is hanging.',
    saturdayTell: 'Shotgun. Mesh in the backfield. Ball gone in two seconds or Baugh has it.',
    whatWins: 'Philo is decisive. Baugh makes the first man miss. The receiver sits in the vacated window.',
    whatLoses: 'Philo holds it. The conflict defender sits. Now it is a late throw into a closing window.',
    relatedIds: ['ss-gap-run', 'ss-qb-progression', 'ss-wr-spacing'],
  },
  {
    id: 'ss-mesh',
    title: 'Mesh Concept',
    unit: 'offense',
    staff: 'Buster Faulkner — OC · WR room (Davis + McKnight)',
    dek: 'Two crossers. One window. The linebackers have to pick.',
    body:
      'Mesh sends shallow crossers from opposite sides. If the linebackers sink, the underneath man is free. If they sit, the second crosser wins behind them. Davis and McKnight install landmarks so Brown, Wilson, and Stockton do not collide at the mesh point. It is the answer vs zone that wants to take away the RPO glance.',
    watchFor: ['Timing of the two crossers', 'Philo’s eyes on linebacker depth', 'Spacing at the mesh point'],
    usageNote: 'Zone-beater from 11 and 10 personnel.',
    callSheet: 'Mesh / mesh-sit. Two shallows, one sit, checkdown.',
    whenUFUses: 'Vs zone shells that sit on the quick game.',
    saturdayTell: 'Two receivers crossing at five yards. Philo holds the first, throws the second.',
    whatWins: 'The first crosser occupies the hook. The second is uncovered.',
    whatLoses: 'They bunch. Or Philo stares the first and the second never comes open.',
    relatedIds: ['ss-wr-spacing', 'ss-rpo-quick', 'ss-te-usage'],
  },
  {
    id: 'ss-gap-run',
    title: 'Gap Scheme Run',
    unit: 'offense',
    staff: 'Buster Faulkner — OC · OL (Phil Trautwein)',
    dek: 'Pullers, angles, and Baugh downhill.',
    body:
      'Gap scheme gives each lineman a hole. A guard or tackle pulls and creates the extra gap. Baugh hits it or bounces when the end crashes. Week 1: 14 carries, 160 yards, three scores, plus the 61-yard 3rd-and-2. Trautwein’s front has to win the first hat. When they do, Faulkner can play-action the next series. When they do not, Florida is throwing from 2nd-and-long.',
    watchFor: ['Puller timing and angle', 'Baugh’s cutback vs the crashing end', 'Pad level at the point'],
    usageNote: 'Identity run. Short yardage and early downs.',
    callSheet: 'Power / counter / duo. Puller or double, Baugh through the gap.',
    whenUFUses: 'Early downs, red zone, and any 3rd-and-short they do not want to throw.',
    saturdayTell: 'A lineman pulling across. Baugh north-south, then the bounce if the end dives.',
    whatWins: 'The puller lands. Baugh does not dance. The first hat is on the ground.',
    whatLoses: 'The puller is late. Baugh gets reached. Now it is 2nd-and-9 and the RPO is dead.',
    relatedIds: ['ss-ol-technique', 'ss-pa-wide-zone', 'ss-rpo-quick'],
  },
  {
    id: 'ss-pa-wide-zone',
    title: 'Play-Action Off Wide Zone',
    unit: 'offense',
    staff: 'Buster Faulkner — OC',
    dek: 'Sell the stretch. Take the top off.',
    body:
      'Wide zone stretches the front. Play-action off that look freezes linebackers and the safety. Faulkner calls it after Baugh has already won — the Abrams 63-yarder vs FAU is the shape of the payoff, even if the official chart does not name the protection. The boot or the deep over is the throw. It only exists if the run is real.',
    watchFor: ['Linebacker freeze', 'Safety depth on the fake', 'Whether the deep shot is earned'],
    usageNote: 'Called after the run has been established.',
    callSheet: 'PA boot / deep over off wide zone.',
    whenUFUses: 'When the box is loaded because Baugh just hit them.',
    saturdayTell: 'The back goes one way. Philo rides it and turns the other. Someone is running past the safety.',
    whatWins: 'The fake is held. The safety steps up. The ball is out on time.',
    whatLoses: 'The fake is a wave. The safety never bites. Now it is a sack or a throwaway.',
    relatedIds: ['ss-gap-run', 'ss-qb-progression', 'ss-wr-spacing'],
  },
  {
    id: 'ss-qb-progression',
    title: 'QB Progression Rules',
    unit: 'offense',
    staff: 'Joe Craddock — Quarterbacks',
    dek: 'Where Philo looks, and in what order.',
    body:
      'Craddock installs the order before the snap: primary, alert, checkdown. Philo’s Week 1 chart (16-of-21, three throw scores, one scramble score) looks like a quarterback who knew the answer. The interception before half is the other side — late into a closing window. Clean feet keep Florida out of negative plays when protection is stressed.',
    watchFor: ['Eyes through the order', 'Ball out on time vs the first rusher', 'Checkdown vs the blitz'],
    usageNote: 'Every dropback. No freelancing the first look.',
    callSheet: 'Progression: 1 to 2 to check. Throw it away before the sack.',
    whenUFUses: 'All dropbacks. Especially third down and red zone.',
    saturdayTell: 'Philo’s feet hit and the ball is gone. Or he tucks the 3-yard score like he did on 4th-and-3.',
    whatWins: 'First answer is right. Checkdown is alive. No hero ball.',
    whatLoses: 'He stares one man. The rush arrives. That is the late INT.',
    relatedIds: ['ss-rpo-quick', 'ss-ol-technique', 'ss-pa-wide-zone'],
  },
  {
    id: 'ss-wr-spacing',
    title: 'WR Spacing Rules',
    unit: 'offense',
    staff: 'Marcus Davis + Trent McKnight — WR coaches',
    dek: 'Landmarks. No bunching. Someone is uncovered.',
    body:
      'Davis and McKnight give each receiver a landmark so Brown, Wilson, Stockton, and Abrams do not occupy the same grass. Week 1: Brown 6-117 and the 49-yard opener, Wilson the chain-mover, Abrams the 63-yard shot. That is spacing working. Zone cannot cover every landmark. Man has to travel.',
    watchFor: ['Landmark discipline', 'Separation at the break', 'Stack vs spread alignment'],
    usageNote: 'Every 10- and 11-personnel snap.',
    callSheet: 'Landmarks by position. No two men in the same window.',
    whenUFUses: 'Always. The RPO and the mesh die without it.',
    saturdayTell: 'Four receivers, four different depths. One of them is alone.',
    whatWins: 'They own their grass. Philo has a window that is actually empty.',
    whatLoses: 'They drift. Two Gators in one zone. The throw has nowhere to go.',
    relatedIds: ['ss-mesh', 'ss-rpo-quick', 'ss-te-usage'],
  },
  {
    id: 'ss-te-usage',
    title: 'TE Usage',
    unit: 'offense',
    staff: 'Evan McKissack — Tight Ends',
    dek: 'Seam, protect, or finish in the red zone.',
    body:
      'McKissack’s room is the 12-personnel lever. Inline they keep the edge honest for Baugh. In the pass game they own the seam vs zone and the red-zone sit. Jones’ 6-yard score from Jones Jr. late vs FAU is the finish look. They also stay in to protect when Faulkner wants the full progression.',
    watchFor: ['Seam vs Cover 3', 'Red-zone target', 'Inline block on the edge run'],
    usageNote: '12 personnel and red zone.',
    callSheet: 'Seam / sit / inline. Protect when asked.',
    whenUFUses: 'Red zone, short yardage, and when the box needs an extra hat.',
    saturdayTell: 'A tight end attached. Either he seals the end or he is running the seam.',
    whatWins: 'The end is sealed. Or the linebacker bites and the seam is late and open.',
    whatLoses: 'They lose the edge. Baugh has nowhere to go. Or they drift into the same window as the Z.',
    relatedIds: ['ss-gap-run', 'ss-wr-spacing', 'ss-ol-technique'],
  },
  {
    id: 'ss-ol-technique',
    title: 'OL Technique',
    unit: 'offense',
    staff: 'Phil Trautwein — Offensive Line',
    dek: 'Hats on hats. The shot only exists if they hold.',
    body:
      'Trautwein coaches pad level, hands, and the stunt call. Week 1 the line created 281 rush yards and gave Philo time for the Abrams shot. The wild snap that lost 20 is the other tape — protection and operation are the same room. If this front holds, Faulkner can run the full progression. If it does not, Florida is living in RPO quick and hoping Baugh wins.',
    watchFor: ['Pressure vs the sim look', 'Combo blocks on gap', 'The twist call'],
    usageNote: 'Every snap. The rest of the offense is downstream.',
    callSheet: 'Zone / gap / max protect. Communicate the twist.',
    whenUFUses: 'Always. Identity is decided up here.',
    saturdayTell: 'Movement at the snap is theirs, not the defense’s. Philo’s feet stay quiet.',
    whatWins: 'First hat down. No free rusher. Baugh has a lane that exists at the snap.',
    whatLoses: 'A missed twist. A snap on the ground. Now it is 2nd-and-28 and you are asking Baugh to save it.',
    relatedIds: ['ss-gap-run', 'ss-qb-progression', 'ss-pa-wide-zone'],
  },
  {
    id: 'ss-odd-front',
    title: '3-Down Odd Front',
    unit: 'defense',
    staff: 'Brad White — DC',
    dek: 'Three down. Five who can rush or cover.',
    body:
      'White’s odd front puts three down linemen and hybrid JACK / STAR bodies who can rush, cover, or fit the run. It lets Florida stay in base vs spread and still bring pressure from more than one edge. Week 1 vs FAU the official chart does not name the front on every snap — do not invent it. What it does show: hurries from Clark, Bett, McCloud, and the two interceptions. The cost of being wrong is the 75-yard Owl drives.',
    watchFor: ['Front declaration', 'JACK / STAR alignment', 'Run fit vs 11 personnel'],
    usageNote: 'Base vs modern spread. Sub only when they have to.',
    callSheet: 'Odd. Three down. JACK and STAR are the movers.',
    whenUFUses: 'Base downs. They stay in it until the offense forces nickel.',
    saturdayTell: 'Three hands in the dirt. Two stand-up edges who might come or might drop.',
    whatWins: 'The box is right. Veltkamp has to throw on time. The takeaway shows up.',
    whatLoses: 'They guess. Ninety plays. Sumrall’s word was atrocious.',
    relatedIds: ['ss-jack', 'ss-star', 'ss-sim-pressure'],
  },
  {
    id: 'ss-sim-pressure',
    title: 'Sim Pressures',
    unit: 'defense',
    staff: 'Brad White — DC',
    dek: 'Show five. Bring four. Or the other way around.',
    body:
      'Simulated pressure shows a blitz and drops a rusher — or shows coverage and brings the extra man late. White triggers it from JACK and STAR so the quarterback cannot ID the rush. Week 1 the official chart logs hurries (Clark, Bett, McCloud, Oyebadejo, Chiles) and does not name the package. Call the hurry. Do not call the coverage behind it until we have the broadcast.',
    watchFor: ['Who actually comes', 'The hole they left', 'Whether the throw is hurried'],
    usageNote: 'Third down and obvious pass.',
    callSheet: 'Sim. Show five, bring four — or show four, bring five.',
    whenUFUses: 'Passing downs when they want a quick throw without emptying the shell.',
    saturdayTell: 'Bodies walking up. At the snap, one of them is dropping.',
    whatWins: 'The quarterback throws hot into a covered man. That is Coleman’s INT shape.',
    whatLoses: 'They bring the extra and nobody is under the throw. That is the 20-yard Valsin score.',
    relatedIds: ['ss-odd-front', 'ss-jack', 'ss-coverage-shells'],
  },
  {
    id: 'ss-jack',
    title: 'JACK Role',
    unit: 'defense',
    staff: 'Bam Hardmon — Outside Linebackers',
    dek: 'Set the edge. Rush. Do not let the quarterback out.',
    body:
      'JACK is the edge of White’s front — contain the run, rush the passer, keep the mobile quarterback inside. Woods showed up on the FAU chart in the run fit. Campbell’s Sixkiller will test this every series. If JACK loses contain, the scramble becomes the explosive.',
    watchFor: ['Edge vs zone read', 'Pass-rush plan on third down', 'Contain vs the scramble'],
    usageNote: 'Every base snap. The edge is the job.',
    callSheet: 'Set. Rush. Collapse. Do not chase inside and give the edge.',
    whenUFUses: 'Always in odd. Third down they become a rusher on purpose.',
    saturdayTell: 'The stand-up end. If the quarterback bounces, JACK failed.',
    whatWins: 'The back is inside. The quarterback is in the pocket. The rush arrives.',
    whatLoses: 'They crash and the quarterback walks around them. That is how 75-yard drives start.',
    relatedIds: ['ss-odd-front', 'ss-sim-pressure', 'ss-dl-technique'],
  },
  {
    id: 'ss-star',
    title: 'STAR Role',
    unit: 'defense',
    staff: 'Chris Collins — Safeties',
    dek: 'Slot. Run fit. The first man tempo tests.',
    body:
      'STAR covers the slot and fits the run from depth in the nickel. Tempo offenses go at this spot first. Week 1 FAU lived in no-huddle — communication between STAR, the linebackers, and the corners has to be clean or the dink game becomes 25 first downs.',
    watchFor: ['Slot matchup', 'Run fit from depth', 'Communication vs no-huddle'],
    usageNote: 'Nickel and any 11-personnel spread.',
    callSheet: 'Match the slot. Fit the alley. Talk before the next snap.',
    whenUFUses: 'Vs spread. They will live here against Campbell.',
    saturdayTell: 'The extra DB in the box. He either takes the slot or he is running downhill.',
    whatWins: 'The slot is covered. The alley is filled. No free access throws.',
    whatLoses: 'They guess. The slot is open. That is how Veltkamp got to 34 completions.',
    relatedIds: ['ss-coverage-shells', 'ss-odd-front', 'ss-run-fits'],
  },
  {
    id: 'ss-coverage-shells',
    title: 'Coverage Shells',
    unit: 'defense',
    staff: 'Brandon Harris + Chris Collins — DB coaches',
    dek: 'Cover 3, quarters, man. Landmarks first.',
    body:
      'Harris and Collins install the shell so corners and safeties know their landmark. White mixes them to take away the vertical without emptying the box. Week 1 vs FAU: we do not have broadcast angles that confirm Cover 3 vs quarters vs man. What we have are the results — Coleman’s INT, Johnson’s INT, McCloud’s 4th-and-2 breakup, and the Valsin 20-yard score. Call the play. Do not invent the shell.',
    watchFor: ['Pre-snap rotation', 'Deep third', 'Man technique on the outside'],
    usageNote: 'Every pass snap. Named only when the tape shows it.',
    callSheet: '3 / quarters / man. Rotate late. Do not guess in print.',
    whenUFUses: 'White mixes. We name it after we see it.',
    saturdayTell: 'Safeties moving late. Corners either turning or sitting.',
    whatWins: 'The deep ball is covered. The INT is the reward.',
    whatLoses: 'They rotate into a hole. That is a 20-yard touchdown, not a “bad call” essay.',
    relatedIds: ['ss-star', 'ss-sim-pressure', 'ss-jack'],
  },
  {
    id: 'ss-run-fits',
    title: 'Run Fits',
    unit: 'defense',
    staff: 'Greg Gasparato — Linebackers',
    dek: 'Own your gap. Scrape. Stay square.',
    body:
      'Gasparato teaches gap-and-scrape. Each linebacker owns a hole, runs to the ball, stays square. Week 1 the official chart shows Graham, Woods, and Robinson in the run alley — and it also shows Ervin and Farrow moving the chains on early downs. Missed fits become explosives. Campbell will keep it with Sixkiller. The fit has to travel.',
    watchFor: ['Gap on power', 'Scrape to the ball', 'Missed tackles at the second level'],
    usageNote: 'Every run snap. SEC weeks live or die here.',
    callSheet: 'Gap. Scrape. Square. Do not cross your teammate’s hole.',
    whenUFUses: 'Always. Tempo does not change the rule.',
    saturdayTell: 'The linebacker filling the hole the lineman left. Or running past it.',
    whatWins: 'The back is on the ground at three. Fourth down becomes a punt.',
    whatLoses: 'Two men in one gap. Nobody in the next. That is the 11-yard Ervin on 3rd-and-3.',
    relatedIds: ['ss-dl-technique', 'ss-odd-front', 'ss-jack'],
  },
  {
    id: 'ss-dl-technique',
    title: 'DL Technique',
    unit: 'defense',
    staff: 'Gerald Chatman — Assistant HC / Defensive Line',
    dek: 'Pad level. Two-gap at nose. Win third down.',
    body:
      'Chatman wants the nose to occupy two gaps and the ends to win on passing downs. McCloud, Bett, and James showed up on the FAU chart — hurry, stuff, sack-fumble. If the front does not move, Graham and Woods can run. If the front gets reached, the 90-play night starts.',
    watchFor: ['Nose on the double', 'Penetration on third down', 'Edge vs the RPO'],
    usageNote: 'The front sets the tone for every White pressure.',
    callSheet: 'Two-gap nose. One-gap on passing downs. Hands first.',
    whenUFUses: 'Every snap. Third down they become hunters.',
    saturdayTell: 'The pile is on their side. Or the quarterback is stepping up untouched.',
    whatWins: 'No free movement inside. The linebacker can run. The sack shows up.',
    whatLoses: 'They get washed. The back is at the second level before Graham can scrape.',
    relatedIds: ['ss-run-fits', 'ss-odd-front', 'ss-sim-pressure'],
  },
  {
    id: 'ss-physical-identity',
    title: 'Physical Identity',
    unit: 'performance',
    staff: 'Rusty Whitt — Director of Football Performance',
    dek: 'Finish the fourth. That is the program.',
    body:
      'Whitt builds the thing Sumrall actually coaches: finish. Week 1 Florida scored 14 in the fourth and kept the Owls at zero. That is the standard. Gap runs and White’s pressure volume only hold if the roster can still move in November. Conditioning is not a side program. It is how Faulkner and White still have a call in the fourth.',
    watchFor: ['Fourth-quarter run efficiency', 'Tackle rate late', 'Penalties when they are tired'],
    usageNote: 'The fourth quarter is the test.',
    callSheet: 'Finish the rep. Finish the series. Finish the night.',
    whenUFUses: 'Every Saturday. You only notice when they don’t.',
    saturdayTell: 'The last drive still looks like the first. Or it doesn’t.',
    whatWins: 'Baugh still hits the hole in the fourth. The defense still gets off the field.',
    whatLoses: 'Soft tackles. Cheap flags. That is a program problem, not a scheme one.',
    relatedIds: ['ss-tempo', 'ss-conditioning', 'ss-gap-run'],
  },
  {
    id: 'ss-tempo',
    title: 'Tempo Philosophy',
    unit: 'performance',
    staff: 'Rusty Whitt · staff',
    dek: 'Practice pace that survives no-huddle.',
    body:
      'Florida practices fast so the defense can talk under stress. FAU ran no-huddle shotgun for 90 plays. Campbell will do the same with Sixkiller. Substitution speed and the call from the sideline are the scheme. If they cannot get the call in, White’s front does not matter.',
    watchFor: ['Substitution speed', 'Communication errors vs no-huddle', 'Late-game execution'],
    usageNote: 'Every series against a tempo offense.',
    callSheet: 'Get the call in. Get the right 11. Do not burn a timeout to exist.',
    whenUFUses: 'Vs no-huddle. That is most of this slate.',
    saturdayTell: 'Florida is set before the offense is. Or they are waving at the sideline.',
    whatWins: 'The front is right. The STAR is in. No free snap.',
    whatLoses: 'Twelve men. Wrong personnel. That is how 75-yard drives start.',
    relatedIds: ['ss-physical-identity', 'ss-star', 'ss-odd-front'],
  },
  {
    id: 'ss-conditioning',
    title: 'Conditioning Themes',
    unit: 'performance',
    staff: 'Rusty Whitt — Director of Football Performance',
    dek: 'Available. Explosive. Still there in November.',
    body:
      'Whitt’s year-round cycle is built to peak in September and hold through rivalry week. Week 1 depth already mattered — Clark and Jones Jr. played real snaps with the game in hand. Availability is the hidden depth chart. Scheme that exists only in August is not a scheme.',
    watchFor: ['Who is still available', 'Explosive rate by quarter', 'Special teams effort late'],
    usageNote: 'Roster health is the call sheet nobody sees.',
    callSheet: 'Recover. Compete. Be out there in November.',
    whenUFUses: 'Every week. You feel it on the third bye or the first injury.',
    saturdayTell: 'The twos look like they belong. Or the ones cannot come off the field.',
    whatWins: 'Clark can finish a drive. The defense can roll a tackle.',
    whatLoses: 'The same 11 on every snap in October. That is how SEC games get away.',
    relatedIds: ['ss-physical-identity', 'ss-tempo', 'ss-te-usage'],
  },
];

export const SCHEME_SCHOOL_UNITS: {
  id: SchemeSchoolUnit;
  label: string;
  staff: string;
  dek: string;
}[] = [
  {
    id: 'offense',
    label: 'Offense',
    staff: 'Buster Faulkner',
    dek: 'Shotgun. Conflict. Baugh downhill when they load it.',
  },
  {
    id: 'defense',
    label: 'Defense',
    staff: 'Brad White',
    dek: 'Odd front. JACK and STAR. Get off the field.',
  },
  {
    id: 'performance',
    label: 'Standard',
    staff: 'Rusty Whitt',
    dek: 'Finish the fourth. Survive tempo. Stay available.',
  },
];

export function schemeSchoolLesson(id: string): SchemeSchoolLesson | undefined {
  return SCHEME_SCHOOL_LESSONS.find((l) => l.id === id);
}

export function schemeLessonsForReview(ids: string[]): SchemeSchoolLesson[] {
  return ids.map((id) => schemeSchoolLesson(id)).filter((lesson): lesson is SchemeSchoolLesson => Boolean(lesson));
}
