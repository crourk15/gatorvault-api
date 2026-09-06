/**
 * 2026 Florida schedule — bundled seed / offline fallback.
 * Live source of truth: `GET /api/schedule` → server/data/schedule/2026-season.json
 * (durable override `/var/data/schedule/2026-season.json`). Edit the JSON for slate
 * fixes without Codemagic after the live-fetch client bake ships.
 */

export type ScheduleGame = {
  id: string;
  /** Regular game (default) or open-date bye. */
  kind?: 'game' | 'bye';
  label: string;
  opp: string;
  date: string;
  venue: string;
  ufPct: number;
  tv?: string;
  keys: string[];
  swing: { name: string; role: string }[];
  film: string;
  /** Fan-facing Film Notes bullets. Command Center prefers this over the scout dump. */
  filmNotes?: string[];
  pred: string;
  /** Explicit projected score — prefer over parsing `pred`. */
  predUF: number;
  predOpp: number;
  /** Verified Film Room opponent-prep lesson id (knowledge engine). */
  filmLessonId?: string;
  /** Opponent offense tendencies (film / box). Fan-facing on live Game Week. */
  opponentTendencies?: string[];
  /** Opponent defense tendencies (film / box / staff-public). Fan-facing on live Game Week. */
  defenseTendencies?: string[];
  /** Raw offense scout log. Scouting tab prefers this when present. */
  offenseScout?: string[];
  /** Raw defense scout log. Scouting tab prefers this when present. */
  defenseScout?: string[];
  howUFWins?: string[];
  scoutingReport?: string;
  /** Expected home visitors for this game week (from game-visitors JSON via API). */
  expectedVisitors?: {
    gameId: string;
    opponent?: string | null;
    dateLabel?: string | null;
    chaseLabel?: string | null;
    source?: string | null;
    visitors: Array<{
      slug: string;
      name: string;
      position?: string | null;
      school?: string | null;
      stars?: number | null;
      classYear?: number | null;
    }>;
  };
  /** Per-game event deep links (not marketplace search pages). */
  tickets?: {
    gameCenter?: string;
    official?: string;
    tickpick?: string;
    stubhub?: string;
    seatgeek?: string;
    ticketmaster?: string;
  };
  /** Official UF uniform combo for this game (helmet / jersey / pants). */
  uniform?: {
    helmet?: string;
    jersey?: string;
    pants?: string;
    label: string;
    note?: string;
    source?: string;
  };
};

export const SCHEDULE_GAMES: ScheduleGame[] = [
  {
    id: "fau",
    label: "Sep 5 vs FAU",
    opp: "FAU Owls",
    date: "September 5, 2026 · 7:45 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 94,
    tv: "SEC Network",
    keys: [
      "Disrupt Veltkamp's rhythm",
      "Attack FAU's run defense",
      "Chunk shots vs a takeaway-light secondary",
    ],
    swing: [
      { name: "Aaron Philo", role: "QB1 — attack a secondary that forced only 3 INTs in 2025" },
      { name: "Jaden Baugh", role: "RB — FAU allowed 200 rush YPG; Navy hit them for 397" },
      { name: "Jayden Woods", role: "JACK — set the edge and rush Veltkamp off rhythm" },
    ],
    film:
      "What the tape shows vs FAU. Shotgun. Pass first. Take the shot and the run. Then throw it over a 3 INT secondary.",
    filmNotes: [
      "Shotgun every snap we have. No under center.",
      "Pass first even when they win. Veltkamp is clean if you let him sit.",
      "They will take the deep shot. Rice clip was about 46 yards.",
      "They will hit the explosive run too. Rice about 68. Navy ran for 397 last year.",
      "Front is 4 down with extra DBs on obvious pass. Coverage calls not on the tape we have.",
      "That defense gave up 200 rush yards a game and only 3 INTs. Run it, then throw it over them.",
    ],
    pred: "UF 38 · FAU 10",
    predUF: 38,
    predOpp: 10,
    filmLessonId: "frl00004-0000-4000-8000-000000000004",
    opponentTendencies: [
      "Shotgun every snap we have. No under center.",
      "Pass first even when they win. Veltkamp is clean if you let him sit.",
      "They will take the deep shot. Rice clip was about 46 yards.",
      "They will hit the explosive run too. Rice about 68. Navy ran for 397 last year.",
    ],
    defenseTendencies: [
      "Front is 4 down with extra DBs on obvious pass. Coverage calls not on the tape we have.",
      "That defense gave up 200 rush yards a game and only 3 INTs. Run it, then throw it over them.",
    ],
    offenseScout: [
      "Shotgun spread on every snap reviewed — no under-center observed",
      "Pass-heavy even in wins (Veltkamp 24/33, 290 vs Rice; 22/29, 272 vs Tulsa)",
      "Vertical shot confirmed: deep TD pass vs Rice (~46-yard clip)",
      "Quick red-zone throw confirmed: short TD pass vs Rice",
      "Explosive run confirmed: long TD rush vs Rice (~68-yard clip)",
      "Tempo / no-huddle between snaps: not confirmed on highlight packages",
      "RPO mesh: not confirmed on these highlight packages",
    ],
    defenseScout: [
      "Film-confirmed (ESPN Maryland + Memphis highlight clips): 4-down front on multiple snaps; nickel/dime DB looks in obvious pass situations",
      "Coverage shells (Cover 2/3/man) + specific pressure packages: NOT confirmed on available highlight angles",
      "Box-confirmed 2025: 36.3 PPG allowed (436 pts / 12) and 435.5 YPG (200 rush / 235 pass)",
      "Explosive-run problem (play results): Memphis 90-yd TD run; Rice 68-yd TD run; Navy 397 rush yards; FIU 224 rush yards",
      "Explosive-pass problem (play results): UConn 446 pass yards; USF 60-yd TD; Memphis 73-yd TD; even in Rice win — 46-yd TD pass allowed",
      "Takeaway-light: only 3 INTs all season (Tied-130th); 8 total takeaways vs 29 giveaways on offense",
      "Pressure volume modest: 23 sacks (Tied-76th) — leaders Batiste 4, Doggette 3.5, Denaud 3, Roberts 3",
      "Tackle volume: Hart 93, Stolsky 86, Williams 62 — they chase plays; explosives still land",
      "Staff/public (not film fronts): DC Brett Dewhurst sells aggressive/havoc, multiple fronts, DB-heavy packages — do not treat as confirmed coverage calls",
    ],
    howUFWins: [
      "Veltkamp was efficient in rhythm when protected (24/33 for 290 vs Rice; 22/29 for 272 vs Tulsa) — pressure before the first read; help over the top on the confirmed vertical shot.",
      "FAU's 2025 defense allowed 200 rush YPG and got gashed for chunk runs (Memphis 90, Rice 68, Navy 397) — establish Baugh early and force them to load the box.",
      "Secondary forced only 3 INTs all year and surrendered chunk shots even in wins — take calculated verticals once the run is honest; do not fear the takeaway.",
    ],
    scoutingReport:
      "FAU OFFENSE (ESPN Rice/Tulsa highlight packages): shotgun spread under Zach Kittley; Veltkamp efficient when protected; confirmed deep TD (~46) and long TD run (~68) vs Rice. Tempo/RPO not confirmed on those cuts. FAU DEFENSE (ESPN Maryland/Memphis highlight clips + full 2025 ESPN drive/box dig across 12 games): 4-down front and nickel/dime looks film-confirmed; coverage shells not confirmed. Unit allowed 36.3 PPG / 435.5 YPG with a clear explosive-run problem and only 3 INTs. Staff-public Dewhurst identity (aggressive, multiple fronts, DB-heavy) is labeled separately — not treated as film-confirmed coverage. UF wins by pressuring Veltkamp, running at a soft front, and taking chunk shots vs a takeaway-light secondary.",
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27903",
      official: "https://www.ticketmaster.com/florida-gators-football-vs-florida-atlantic-gainesville-florida-09-05-2026/event/2200645C21820922",
      tickpick: "https://www.tickpick.com/buy-florida-gators-vs-florida-atlantic-owls-tickets-ben-hill-griffin-stadium-9-5-26-7pm/7622666/",
      stubhub: "https://www.stubhub.com/florida-gators-football-gainesville-tickets-9-5-2026/event/160067981/",
      ticketmaster: "https://www.ticketmaster.com/florida-gators-football-vs-florida-atlantic-gainesville-florida-09-05-2026/event/2200645C21820922",
    },
    uniform: {
      helmet: "Orange",
      jersey: "Blue",
      pants: "White",
      label: "Orange / Blue / White",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "campbell",
    label: "Sep 12 vs Campbell",
    opp: "Campbell Camels",
    date: "September 12, 2026 · 5:30 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 96,
    tv: "SECN+",
    keys: [
      "Crowd Sixkiller before the first read",
      "Run it at last year's front",
      "Finish drives - do not turn this into 49",
    ],
    swing: [
      { name: "Aaron Philo", role: "Attack a secondary that allowed 27 pass TDs in 2025" },
      { name: "Jaden Baugh", role: "Run-game rhythm vs 143 rush YPG allowed" },
      { name: "Jayden Woods", role: "Keep Sixkiller in the pocket" },
    ],
    film: "What the boxes show vs Campbell. Sixkiller throws it and runs it. Last year's defense gave up 37 a game. Then throw it over a 27-TD secondary.",
    pred: "UF 42 · Campbell 7",
    predUF: 42,
    predOpp: 7,
    opponentTendencies: [
      "Sixkiller can beat you with his arm and his legs.",
      "They will take the deep shot. Austin went 50 yards and scored from 30 at ETSU. King had a 77-yard TD vs Bryant last year.",
      "2025 they averaged 23 a game and 346 yards. The 2026 opener was 49 points and 514 yards.",
    ],
    defenseTendencies: [
      "Last year that defense gave up 37 a game and 27 pass TDs. Run it, then throw it over them.",
      "New coordinator this year. Coverage calls are not on the tape we have.",
    ],
    howUFWins: [
      "Sixkiller just went 29/42 for 343 with 95 rush yards and four touchdowns at ETSU (box, Aug 29). Pressure before the first read and keep him in the pocket.",
      "Official 2025 cumulative: Campbell allowed 37.18 PPG and 430.3 YPG (143 rush / 287 pass) with 27 pass TDs allowed vs 5 INTs. Establish Baugh early and take calculated shots once the run is honest.",
      "Campbell scored 49 at ETSU and went 2-10 in 2025 after a pile of late leads. Stay on schedule, finish red-zone trips, and keep special teams clean so this does not become a track meet.",
    ],
    scoutingReport:
      "CAMPBELL OFFENSE (boxes, not a Hudl watch): Braxton Harris / OC Matt Kubik with returning QB Kamden Sixkiller. 2025 official line 23.45 PPG / 346.1 YPG. 2026 opener at ETSU (Aug 29) was 49-37, 514 yards — Sixkiller 29/42 for 343, 10-95 rushing, four TDs, no sacks. JJ Cowan was quiet that night (6-16); Evan Austin and Stevie Keener took the shots. CAMPBELL DEFENSE (boxes + staff-public): 2025 cumulative 37.18 PPG / 430.3 YPG allowed, 27 pass TDs vs 5 INTs. New 2026 DC Brandon Butcher (2025 was Eric Daniels). Coverage shells and fronts are NOT confirmed — no tape watch. WCU on Sep 5 was postponed (weather/electrical); no second 2026 box as of Sep 6. UF wins by crowding Sixkiller, running at last year's front, and finishing drives.",
    filmNotes: [
      "Sixkiller is the show. He can throw it and run it.",
      "ETSU opener: 29 of 42 for 343, 95 on the ground, four touchdowns. Campbell put up 514 yards.",
      "They will take the shot. Austin went 50 yards and scored from 30 at ETSU. King had a 77-yard TD vs Bryant last year.",
      "Last year's front gave up 37 a game and 27 pass touchdowns. Run it, then throw it over them.",
      "New defensive coordinator this year. Coverage calls are not on the tape we have.",
      "Do not let this become a track meet. They scored 49 at ETSU.",
    ],
    offenseScout: [
      "Staff-public: HC Braxton Harris (3rd season), OC Matt Kubik, returning QB Kamden Sixkiller",
      "Box-confirmed 2025 (gocamels cumulative, posted 2-10): 23.45 PPG, 346.1 YPG (119.4 rush / 226.7 pass)",
      "Box-confirmed 2025 Sixkiller (official 10 GP): 220/351, 2102 yds, 12 TD, 5 INT — ESPN gamelog 224/357, 2154, 12 TD, 5 INT, 21 sacks",
      "Box-confirmed 2025 RB JJ Cowan: 402 yds, 4.7 YPC, 5 TD in 9 GP (long 64)",
      "Box-confirmed 2025 WR Randall King: 59-689-5, long 77 (Bryant play result)",
      "Box-confirmed 2026 opener at ETSU (Aug 29): W 49-37, 514 yards; Sixkiller 29/42, 343, 2 pass TD, 0 INT, 10-95 rushing, 2 rush TD, 0 sacks",
      "ETSU play results: Evan Austin 4-93 (30-yd TD, 50-yd catch); Stevie Keener 26-yd TD; Devon Thomas 2 rush TDs; Ethan Lawrence rush TD; JJ Cowan 6-16",
      "WCU home opener postponed Sep 5 (weather/electrical) — no second 2026 box as of Sep 6",
      "Formation / RPO / tempo between snaps: NOT confirmed — no Hudl watch",
    ],
    defenseScout: [
      "Staff-public: 2025 DC Eric Daniels; 2026 DC Brandon Butcher (1st year) — do not treat as a film-confirmed front",
      "Coverage shells (Cover 2/3/man) + pressure packages: NOT confirmed — no Hudl / highlight-package watch",
      "Box-confirmed 2025 (gocamels cumulative): 37.18 PPG allowed (409 pts) and 430.3 YPG (143 rush / 287 pass)",
      "Explosive-pass problem (season line): 27 pass TDs allowed, 5 INTs, 8.49 yards per attempt",
      "Rush defense: 143 YPG, 4.4 per carry, 23 rush TDs allowed",
      "Pressure volume modest: 15 sacks on the year",
      "Red zone: opponents 42-49 scoring trips, 34 TDs",
      "Do not invent coverage calls from the new coordinator",
    ],
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27904",
      official: "https://www.ticketmaster.com/florida-gators-football-vs-campbell-university-gainesville-florida-09-12-2026/event/2200645C21870928",
      tickpick: "https://www.tickpick.com/buy-florida-gators-vs-campbell-fighting-camels-tickets-ben-hill-griffin-stadium-9-12-26-5pm/7622668/",
      stubhub: "https://www.stubhub.com/florida-gators-football-gainesville-tickets-9-12-2026/event/160067983/",
      ticketmaster: "https://www.ticketmaster.com/florida-gators-football-vs-campbell-university-gainesville-florida-09-12-2026/event/2200645C21870928",
    },
    uniform: {
      helmet: "Blue",
      jersey: "Orange",
      pants: "White",
      label: "Blue / Orange / White",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "auburn",
    label: "Sep 19 @ Auburn",
    opp: "Auburn Tigers",
    date: "September 19, 2026 · 7:00 PM ET",
    venue: "Jordan-Hare Stadium, Auburn AL",
    ufPct: 51,
    tv: "ESPN",
    keys: ["Control LOS", "Limit explosive plays", "Win 3rd down"],
    swing: [
      { name: "Singleton Jr.", role: "First road SEC test" },
      { name: "Cormani McClain", role: "Neutralize their #1 WR" },
    ],
    film: "Auburn runs physical downhill ball. Jordan-Hare in September is tough.",
    pred: "UF 24 · Auburn 21",
    predUF: 24,
    predOpp: 21,
    filmLessonId: "frl00005-0000-4000-8000-000000000005",
    opponentTendencies: ["Gap-scheme downhill run game", "Physical at the point of attack", "Play-action off run success"],
    howUFWins: ["Trautwein OL wins line of scrimmage", "Gasparato linebackers fit gaps cleanly", "Avoid negative plays on the road"],
    scoutingReport:
      "Auburn wants to control the clock with power run. UF must win early downs and limit explosives in a hostile environment.",
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27905",
      tickpick: "https://www.tickpick.com/buy-auburn-tigers-vs-florida-gators-tickets-jordan-hare-stadium-9-19-26-6pm/7620863/",
      stubhub: "https://www.stubhub.com/auburn-tigers-football-auburn-tickets-9-19-2026/event/159474210/",
    },
    uniform: {
      helmet: "Orange",
      jersey: "White",
      pants: "Orange",
      label: "Orange / White / Orange",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "olemiss",
    label: "Sep 26 vs Ole Miss",
    opp: "Ole Miss Rebels",
    date: "September 26, 2026 · 3:30–8:00 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 50,
    tv: "TBD",
    keys: [
      "Match their tempo without mistakes",
      "Pressure their QB",
      "Win early downs",
    ],
    swing: [
      { name: "Jayden Woods", role: "Edge pressure" },
      { name: "QB1", role: "Avoid negative plays" },
    ],
    film: "Ole Miss tempo offense stresses communication.",
    pred: "UF 27 · Ole Miss 28",
    predUF: 27,
    predOpp: 28,
    howUFWins: [
      "Ole Miss tempo stresses communication — match pace without negative plays or coverage busts.",
      "Get edge pressure and force them off schedule before the first read.",
      "Win early downs so the Rebels cannot live in obvious passing situations.",
    ],
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27906",
      official: "https://www.ticketmaster.com/florida-gators-football-vs-ole-miss-gainesville-florida-09-26-2026/event/2200645C218D0934",
      tickpick: "https://www.tickpick.com/buy-florida-gators-vs-mississippi-rebels-tickets-ben-hill-griffin-stadium-9-26-26-3am/7620866/",
      ticketmaster: "https://www.ticketmaster.com/florida-gators-football-vs-ole-miss-gainesville-florida-09-26-2026/event/2200645C218D0934",
    },
    uniform: {
      helmet: "Orange",
      jersey: "Blue",
      pants: "White",
      label: "Orange / Blue / White",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "missouri",
    label: "Oct 3 @ Missouri",
    opp: "Missouri Tigers",
    date: "October 3, 2026 · 3:30–8:00 PM ET",
    venue: "Faurot Field, Columbia MO",
    ufPct: 47,
    tv: "TBD",
    keys: ["Establish run on road", "Win turnover battle", "Execute red zone"],
    swing: [
      { name: "Jaden Baugh", role: "Physical run game" },
      { name: "Secondary", role: "Limit deep shots" },
    ],
    film: "Missouri uses RPO and play-action.",
    pred: "UF 23 · Missouri 27",
    predUF: 23,
    predOpp: 27,
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27907",
      official: "https://www.ticketmaster.com/2026-mizzou-football-v-florida-columbia-missouri-10-03-2026/event/060064A9DD1A37BC",
      tickpick: "https://www.tickpick.com/buy-missouri-tigers-vs-florida-gators-tickets-faurot-field-at-memorial-stadium-10-3-26-3am/7620964/",
      ticketmaster: "https://www.ticketmaster.com/2026-mizzou-football-v-florida-columbia-missouri-10-03-2026/event/060064A9DD1A37BC",
    },
    uniform: {
      helmet: "Orange",
      jersey: "White",
      pants: "Blue",
      label: "Orange / White / Blue",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "scar",
    label: "Oct 10 vs South Carolina (HC)",
    opp: "South Carolina Gamecocks",
    date: "October 10, 2026 · 12:00–1:00 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 64,
    tv: "TBD",
    keys: ["Win rivalry week", "Control clock", "Limit their QB run game"],
    swing: [
      { name: "Edge defenders", role: "Contain QB run" },
      { name: "Singleton Jr.", role: "Win one-on-ones" },
    ],
    film: "Homecoming vs South Carolina. RPO-heavy.",
    pred: "UF 27 · South Carolina 20",
    predUF: 27,
    predOpp: 20,
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27908",
      official: "https://www.ticketmaster.com/florida-gators-football-vs-univ-of-gainesville-florida-10-10-2026/event/2200645C21920948",
      tickpick: "https://www.tickpick.com/buy-florida-gators-vs-south-carolina-gamecocks-tickets-ben-hill-griffin-stadium-10-10-26-3am/7620865/",
      ticketmaster: "https://www.ticketmaster.com/florida-gators-football-vs-univ-of-gainesville-florida-10-10-2026/event/2200645C21920948",
    },
    uniform: {
      helmet: "Retro",
      jersey: "White",
      pants: "White",
      label: "Retro / White / White",
      note: "Retro whites — Homecoming",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "texas",
    label: "Oct 17 @ Texas",
    opp: "Texas Longhorns",
    date: "October 17, 2026 · 12:00–1:00 PM ET",
    venue: "DKR-Texas Memorial Stadium, Austin TX",
    ufPct: 37,
    tv: "TBD",
    keys: ["Protect the football", "Win early downs", "Limit explosives"],
    swing: [
      { name: "QB1", role: "Decision-making vs pressure" },
      { name: "OL", role: "Road pass protection" },
    ],
    film: "Texas balanced attack with elite skill.",
    pred: "UF 20 · Texas 31",
    predUF: 20,
    predOpp: 31,
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27909",
      tickpick: "https://www.tickpick.com/buy-texas-longhorns-vs-florida-gators-tickets-darrell-k-royal-texas-memorial-stadium-10-17-26-3am/7620985/",
    },
    uniform: {
      helmet: "Orange",
      jersey: "White",
      pants: "Blue",
      label: "Orange / White / Blue",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "bye-oct24",
    kind: 'bye',
    label: "Oct 24 BYE",
    opp: "Bye week",
    date: "October 24, 2026 · OFF",
    venue: "Invesco QQQ Atlanta Gridiron Classic week",
    ufPct: 0,
    tv: "—",
    keys: [],
    swing: [],
    film: "Open date — Invesco QQQ Atlanta Gridiron Classic week on the SEC calendar.",
    pred: "",
    predUF: 0,
    predOpp: 0,
    scoutingReport:
      "Florida is off Oct 24. SEC open date aligns with the Atlanta Gridiron Classic week.",
  },
  {
    id: "uga",
    label: "Oct 31 vs Georgia",
    opp: "Georgia Bulldogs",
    date: "October 31, 2026 · 3:30 PM ET",
    venue: "Mercedes-Benz Stadium, Atlanta GA",
    ufPct: 40,
    tv: "ABC",
    keys: ["Control time of possession", "Get pressure on their QB", "Establish run before going downfield"],
    swing: [
      { name: "Jadan Baugh", role: "Must go 100+ yards" },
      { name: "Jayden Woods", role: "Must generate pressure" },
    ],
    film: "Neutral-site Cocktail Party at Mercedes-Benz Stadium in Atlanta for 2026.",
    pred: "UF 20 · Georgia 27",
    predUF: 20,
    predOpp: 27,
    scoutingReport:
      "Georgia series moves to Atlanta in 2026 (Mercedes-Benz). UF path is controlling the ball and limiting explosives in a neutral-site environment.",
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27910",
      official: "https://am.ticketmaster.com/gators/en/buy/ism/RkIyNjA4R0E=",
      tickpick: "https://www.tickpick.com/buy-georgia-bulldogs-vs-florida-gators-tickets-mercedes-benz-stadium-10-31-26-3am/7621006/",
      ticketmaster: "https://am.ticketmaster.com/gators/en/buy/ism/RkIyNjA4R0E=",
    },
    uniform: {
      helmet: "Orange",
      jersey: "White",
      pants: "White",
      label: "Orange / White / White",
      note: "Neutral site — Atlanta",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "oklahoma",
    label: "Nov 7 vs Oklahoma",
    opp: "Oklahoma Sooners",
    date: "November 7, 2026 · 3:30–8:00 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 48,
    tv: "TBD",
    keys: ["Win early downs", "Protect the football", "Limit explosives"],
    swing: [
      { name: "QB1", role: "Pace vs SEC-speed pressure" },
      { name: "Secondary", role: "Match skill in space" },
    ],
    film: "Oklahoma brings tempo and skill. Swamp night energy matters.",
    pred: "UF 24 · Oklahoma 27",
    predUF: 24,
    predOpp: 27,
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27911",
      official: "https://www.ticketmaster.com/florida-gators-football-vs-oklahoma-sooners-gainesville-florida-11-07-2026/event/2200645C2197098A",
      tickpick: "https://www.tickpick.com/buy-florida-gators-vs-oklahoma-sooners-tickets-ben-hill-griffin-stadium-11-7-26-3am/7620868/",
      ticketmaster: "https://www.ticketmaster.com/florida-gators-football-vs-oklahoma-sooners-gainesville-florida-11-07-2026/event/2200645C2197098A",
    },
    uniform: {
      helmet: "Blue",
      jersey: "Blue",
      pants: "Blue",
      label: "All-Blue",
      note: "All-Blue in The Swamp",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "kentucky",
    label: "Nov 14 @ Kentucky",
    opp: "Kentucky Wildcats",
    date: "November 14, 2026 · 6:00–8:00 PM ET",
    venue: "Kroger Field, Lexington KY",
    ufPct: 55,
    tv: "TBD",
    keys: ["Physical run fits", "Win the trenches", "Finish in red zone"],
    swing: [
      { name: "Jadan Baugh", role: "Wear down front" },
      { name: "WR room", role: "Explosive plays" },
    ],
    film: "Kentucky power run and play-action on the road.",
    pred: "UF 24 · Kentucky 21",
    predUF: 24,
    predOpp: 21,
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27912",
      official: "https://www.ticketmaster.com/kentucky-wildcats-football-vs-florida-gators-lexington-kentucky-11-14-2026/event/160064ACA20A7989",
      tickpick: "https://www.tickpick.com/buy-kentucky-wildcats-vs-florida-gators-tickets-kroger-field-11-14-26-3am/7620880/",
      ticketmaster: "https://www.ticketmaster.com/kentucky-wildcats-football-vs-florida-gators-lexington-kentucky-11-14-2026/event/160064ACA20A7989",
    },
    uniform: {
      helmet: "Orange",
      jersey: "White",
      pants: "Orange",
      label: "Orange / White / Orange",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "vandy",
    label: "Nov 21 vs Vanderbilt",
    opp: "Vanderbilt Commodores",
    date: "November 21, 2026 · 12:00–1:00 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 72,
    tv: "TBD",
    keys: ["Execute early", "Avoid complacency", "Develop depth"],
    swing: [
      { name: "Backup units", role: "Rep evaluation" },
      { name: "QB1", role: "Efficient scoring drives" },
    ],
    film: "Vanderbilt improving — treat as SEC test.",
    pred: "UF 31 · Vanderbilt 17",
    predUF: 31,
    predOpp: 17,
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27913",
      official: "https://www.ticketmaster.com/florida-gators-football-vs-vanderbilt-commodores-gainesville-florida-11-21-2026/event/2200645C219C0A2B",
      tickpick: "https://www.tickpick.com/buy-florida-gators-vs-vanderbilt-commodores-tickets-ben-hill-griffin-stadium-11-21-26-3am/7620867/",
      ticketmaster: "https://www.ticketmaster.com/florida-gators-football-vs-vanderbilt-commodores-gainesville-florida-11-21-2026/event/2200645C219C0A2B",
    },
    uniform: {
      helmet: "Orange",
      jersey: "Blue",
      pants: "White",
      label: "Orange / Blue / White",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
  {
    id: "fsu",
    label: "Nov 27 @ FSU",
    opp: "Florida State Seminoles",
    date: "November 27, 2026 · 3:30 PM ET",
    venue: "Doak Campbell Stadium, Tallahassee FL",
    ufPct: 56,
    tv: "ABC",
    keys: ["Win field position battle", "Avoid penalties", "Win turnover margin"],
    swing: [
      { name: "QB1", role: "Composure in hostile environment" },
      { name: "Myles Graham", role: "Contain their TE weapon" },
    ],
    film: "Everything on the line. UF takes Doak — finish drives and win the turnover battle.",
    pred: "UF 27 · FSU 24",
    predUF: 27,
    predOpp: 24,
    filmLessonId: "frl00010-0000-4000-8000-00000000000a",
    opponentTendencies: ["RPO and quick game in rivalry setting", "TE usage in red zone", "Tempo spikes in critical moments"],
    howUFWins: ["Faulkner wins early downs without turnovers", "White coverage matches sim pressure looks", "Special teams and field position decide it"],
    scoutingReport:
      "Rivalry game at Doak — field position and turnover margin decide it. UF's 3-3-5 is built to handle spread RPO; offense must finish drives.",
    tickets: {
      gameCenter: "https://floridagators.com/game-center/27914",
      tickpick: "https://www.tickpick.com/buy-florida-state-seminoles-vs-florida-gators-tickets-doak-campbell-stadium-11-27-26-3pm/7528939/",
    },
    uniform: {
      helmet: "Blue",
      jersey: "White",
      pants: "White",
      label: "Blue / White / White",
      source: "GatorsFB 2026 lineup https://x.com/GatorsFB/status/2089490556275552318",
    },
  },
];
