/**
 * 2026 Florida schedule — bundled seed / offline fallback.
 * Live source of truth: `GET /api/schedule` → server/data/schedule/2026-season.json
 * (durable override `/var/data/schedule/2026-season.json`). Edit the JSON for slate
 * fixes without Codemagic after the live-fetch client bake ships.
 * Remaining-season `ufPct` / `pred` restamp after each Saturday from how Florida
 * and those opponents actually looked (`predThrough` on the API board).
 * Swing `impact` / `trend` are computed at serve from official box form + this
 * opponent — seed 95 is fallback only.
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
  swing: { name: string; role: string; impact?: number; trend?: 'up' | 'down' | 'flat' }[];
  /**
   * Optional Matchup Edge axes (0–100). When present, Game Week uses this
   * instead of the win% formula. Stamp from the sit — do not invent.
   */
  radar?: { label: string; uf: number; opp: number }[];
  film: string;
  /** Fan-facing Film Notes bullets. Command Center prefers this over the scout dump. */
  filmNotes?: string[];
  pred: string;
  /** Explicit projected score — prefer over parsing `pred`. */
  predUF: number;
  predOpp: number;
  /** Season week the remaining-game prediction last restamped (e.g. 2026-W2). */
  predThrough?: string;
  /** Official final after the whistle — Game Zone grades tickets from this. */
  finalUF?: number;
  finalOpp?: number;
  finalSource?: string;
  /** Official box score page (floridagators.com stats). */
  boxScoreUrl?: string;
  /** Verified Film Room opponent-prep lesson id (knowledge engine). */
  filmLessonId?: string;
  /** GatorVault Film Review id (our weekly board). */
  vaultReviewId?: string;
  /** True only after a real Hudl / film-desk watch. Box drafts stay false. */
  filmWatched?: boolean;
  /** Opponent offense tendencies (film / box). Fan-facing on live Game Week. */
  opponentTendencies?: string[];
  /** Opponent defense tendencies (film / box / staff-public). Fan-facing on live Game Week. */
  defenseTendencies?: string[];
  /** Special teams bullets on the Scouting Report tab. */
  specialTeams?: string[];
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
      { name: "Jaden Baugh", impact: 95, role: "RB — FAU allowed 200 rush YPG; Navy hit them for 397" },
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
    finalUF: 66,
    finalOpp: 21,
    finalSource: "official",
    boxScoreUrl: "https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903",
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
      "Veltkamp was efficient in rhythm when protected (24/33 for 290 vs Rice; 22/29 for 272 vs Tulsa) — pressure before the first read; help over the top on the vertical shot.",
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
      "Attack last year's run defense",
      "Chunk shots vs a 5-INT secondary",
    ],
    swing: [
      { name: "Aaron Philo", role: "Attack a secondary that allowed 27 pass TDs in 2025" },
      { name: "Jaden Baugh", impact: 95, role: "Run-game rhythm vs 143 rush YPG allowed" },
      { name: "Jayden Woods", role: "Keep Sixkiller in the pocket" },
    ],
    filmWatched: true,
    film: "Campbell is Sixkiller. Crowd him or he throws it, keeps it, and takes the shot over the top. Then go score — last year's defense gave up 37 a game.",
    pred: "UF 42 · Campbell 7",
    predUF: 42,
    predOpp: 7,
    finalUF: 52,
    finalOpp: 3,
    finalSource: "official",
    boxScoreUrl: "https://floridagators.com/sports/football/stats/2026/campbell/boxscore/27904",
    opponentTendencies: [
      "No-huddle shotgun every snap we have. No under center.",
      "Sixkiller is the show. He can throw it and run it.",
      "They will take the deep shot. Austin was wide open for 30. Keener walked in from 26.",
      "He will keep it. Two rushing TDs at ETSU. Stay in your lane.",
    ],
    defenseTendencies: [
      "Last year that defense gave up 37 a game and 27 pass TDs. Run it, then throw it over them.",
      "New coordinator this year. Coverage calls not on the tape we have.",
    ],
    howUFWins: [
      "Sixkiller sat in the gun at ETSU (29/42, 343, 0 sacks) and still ran for 95 and two scores. Pressure before the first read, keep contain on the keep, and help over the top — Austin was wide open for 30 and Keener walked in from 26.",
      "Official 2025: Campbell allowed 37.18 PPG and 430.3 YPG (143 rush / 287 pass) with 0 sacks at ETSU. Establish Baugh early and force them to load the box.",
      "Secondary allowed 27 pass TDs vs 5 INTs (8.49 YPA) and opponents scored on 42 of 49 red-zone trips. Take calculated shots once the run is honest and finish the drive.",
    ],
    scoutingReport:
      "CAMPBELL OFFENSE (ESPN+ ETSU broadcast + official PBP, Aug 29): no-huddle shotgun on every Campbell snap charted; no under-center. Sixkiller 29/42 for 343, 0 INT, 0 sacks, plus 10-95 rushing and two keep/scramble TDs. Confirmed verticals: Austin 30-yd TD (wide-open / busted coverage on the call) and 50-yd catch; Keener 26-yd TD walking in. Gullette used as a space back (26-yd run). RPO mesh not confirmed. CAMPBELL DEFENSE (that broadcast + 2025 boxes): allowed 528 yards / 37 at ETSU with 0 sacks; two forced fumbles (Garza, Bedada). 2025 cumulative 37.18 PPG / 430.3 YPG, 27 pass TDs vs 5 INTs. New DC Brandon Butcher. Coverage shells NOT confirmed on broadcast angles. WCU Sep 5 postponed. UF wins by crowding Sixkiller, running at last year's front, and taking the shots.",
    filmNotes: [
      "Campbell is Sixkiller. Crowd him or he throws it, keeps it, and takes the shot over the top. Then go score — last year's defense gave up 37 a game.",
      "No-huddle shotgun every snap we have. No under center.",
      "Sixkiller is the show. He can throw it and run it.",
      "They will take the deep shot. Austin was wide open for 30. Keener walked in from 26.",
      "He will keep it. Two rushing TDs at ETSU. Stay in your lane.",
      "Last year's front gave up 37 a game and 27 pass touchdowns. Run it, then throw it over them.",
      "New coordinator this year. Coverage calls not on the tape we have.",
    ],
    offenseScout: [
      "Film-confirmed (ESPN+ ETSU broadcast + official gocamels PBP, Aug 29): No Huddle-Shotgun on every Campbell snap charted — no under-center observed",
      "Tempo confirmed: no-huddle on the PBP every snap; they will go quick after a chunk",
      "Pass-first openers, then mix QB keep / Gullette / Lawrence — Sixkiller 29/42, 343, 2 pass TD, 0 INT, 0 sacks",
      "Vertical shot confirmed: Austin 30-yd TD (booth: busted coverage, wide open) and 50-yd catch (long of the night)",
      "Keener 26-yd TD confirmed: walking into the end zone late first half",
      "QB run confirmed: Sixkiller 5-yd TD, 14-yd TD, long rush 42 — 10-95, 2 rush TD",
      "Gullette space-back confirmed: 26-yd run plus checkdowns; Cowan quiet (6-16)",
      "RPO mesh: NOT confirmed as a called RPO on these angles",
      "Box-confirmed 2025 (gocamels cumulative, posted 2-10): 23.45 PPG, 346.1 YPG (119.4 rush / 226.7 pass)",
      "Box-confirmed 2025 Sixkiller (official 10 GP): 220/351, 2102 yds, 12 TD, 5 INT — ESPN gamelog 21 sacks",
      "Box-confirmed 2025 WR Randall King 59-689-5, long 77 vs Bryant (play result, not this broadcast)",
      "WCU home opener postponed Sep 5 (weather/electrical) — no second 2026 box as of Sep 6",
    ],
    defenseScout: [
      "Film-confirmed (ESPN+ ETSU): Campbell D allowed 528 yards and 37 points; 0 sacks in the individual table",
      "Takeaways that night: two fumbles (Garza FF/FR 29 yards; Bedada FR). Battaglia 12 tackles + FF",
      "Coverage shells (Cover 2/3/man) + pressure packages: NOT confirmed on broadcast angles",
      "Staff-public: 2025 DC Eric Daniels; 2026 DC Brandon Butcher (1st year) — do not treat as a film-confirmed front",
      "Box-confirmed 2025 (gocamels cumulative): 37.18 PPG allowed (409 pts) and 430.3 YPG (143 rush / 287 pass)",
      "Explosive-pass problem (season line): 27 pass TDs allowed, 5 INTs, 8.49 yards per attempt",
      "Rush defense: 143 YPG, 4.4 per carry, 23 rush TDs allowed",
      "Pressure volume modest: 15 sacks on the year",
      "Red zone: opponents 42-49 scoring trips, 34 TDs",
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
    keys: [
      "Throw it over the loaded box",
      "Crowd Byrum Brown before the first read",
      "Don't let the short throw become a long run",
    ],
    swing: [
      { name: "Jayden Woods", role: "Keep Byrum Brown in the pocket" },
      { name: "Jadan Baugh", impact: 95, role: "Early-down rhythm vs a front that held Baylor to 103 rush" },
      { name: "Aaron Philo", role: "They sit on the run — Baylor still threw 333" },
    ],
    filmWatched: false,
    film: "Auburn is no-huddle shotgun and Byrum Brown. Crowd him or he throws it short and keeps it. Three turnovers in Atlanta; they won it with a keep left. Then go score — they sit on the run and you throw it over them.",
    pred: "UF 27 · Auburn 23",
    predUF: 27,
    predOpp: 23,
    finalUF: 44,
    finalOpp: 39,
    finalSource: "official",
    boxScoreUrl: "https://floridagators.com/sports/football/stats/2026/auburn/boxscore/27905",
    opponentTendencies: [
      "They do not huddle up. Almost every snap vs Baylor was no-huddle shotgun.",
      "They will keep it. The winning score was keep left 11. Stay in your lane.",
      "Cain then Cobb is the bounce they will run if you sit inside.",
      "The chunk throws were short and ran — Koger 30, Nimrod 26. Crowd the catch.",
      "Keshaun Singleton is the volume guy — 7 for 89 when they need a chain.",
      "Three picks when he was off schedule. Crowd him and make him live as a thrower.",
      "They will go on 4th-and-medium. Do not treat it as a punt.",
    ],
    defenseTendencies: [
      "Last year that front sat on the run — 99 rush yards a game, 2.9 a carry.",
      "Baylor got 103 on the ground and still threw for 333. If they load it, throw it over them.",
      "Coverage calls not on the tape we have.",
    ],
    howUFWins: [
      "That's how you score on this front. They sit on the run — Baylor got 103 on the ground and still threw for 333. If they load it, throw it over them.",
      "That's how you get him off schedule. When he's late, he forces it — three picks. Crowd Byrum Brown and stay home on the keep.",
      "That's how they got their chunks. Keshaun Singleton, Koger, Nimrod caught it short and ran. Get there and wrap them up.",
    ],
    scoutingReport:
      "AUBURN OFFENSE (official Baylor PBP sit, 78 snaps): This is no-huddle shotgun and Byrum Brown, not Freeze downhill. 72 No Huddle-Shotgun, 0 under-center. 26/35, 259, 0 pass TD, 3 INT, plus 21-27-1 rushing. 25 of 26 completions were short. Winning score was keep left 11. Cain bounce 25 then Cobb 15. Chunks were short throws that ran — Koger 30, Nimrod 26. Three picks when he was off schedule. They will go on 4th-and-medium (0-1). AUBURN DEFENSE (2025 Durkin boxes + Baylor): 12th rush D last year (99.3 YPG, 2.86). Week 1 they stuffed Baylor on the ground (103) and gave up 333 passing with 1 sack. Coverage shells NOT confirmed. UF wins by crowding Brown, staying in the lane on the keep, crowding the short catch, then throwing it over a loaded box. Jordan-Hare night is the environment — not the picture. filmWatched: false.",
    filmNotes: [
      "Auburn is no-huddle shotgun and Byrum Brown. Crowd him or he throws it short and keeps it. Three turnovers in Atlanta; they won it with a keep left. Then go score — they sit on the run and you throw it over them.",
      "They do not huddle up. Almost every snap vs Baylor was no-huddle shotgun.",
      "They will keep it. The winning score was keep left 11. Stay in your lane.",
      "Cain then Cobb is the bounce they will run if you sit inside.",
      "The chunk throws were short and ran — Koger 30, Nimrod 26. Crowd the catch.",
      "Keshaun Singleton is the volume guy — 7 for 89 when they need a chain.",
      "Three picks when he was off schedule. Crowd him and make him live as a thrower.",
      "Last year that front sat on the run — 99 rush yards a game, 2.9 a carry.",
      "Baylor got 103 on the ground and still threw for 333. If they load it, throw it over them.",
      "They will go on 4th-and-medium. Do not treat it as a punt.",
      "Coverage calls not on the tape we have.",
    ],
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
    date: "September 26, 2026 · 3:30 PM ET",
    venue: "Ben Hill Griffin Stadium, Gainesville FL",
    ufPct: 51,
    tv: "ABC",
    keys: [
      "Maintain Lane Discipline & Crowd Chambliss",
      "Cap the Vertical Shots",
      "Establish the Downhill Run Game",
    ],
    swing: [
      { name: "Jadan Baugh", impact: 95, role: "Early-down rhythm vs a front that just gave LSU 172" },
      { name: "Jayden Woods", role: "Stay in the lane on the Chambliss keep" },
      { name: "Aaron Philo", role: "When they load the box, go over the top" },
    ],
    radar: [
      { label: "Run Game", uf: 70, opp: 56 },
      { label: "Pass Efficiency", uf: 66, opp: 78 },
      { label: "Front 7", uf: 72, opp: 48 },
      { label: "Secondary", uf: 68, opp: 54 },
      { label: "Special Teams", uf: 58, opp: 58 },
      { label: "Coaching Edge", uf: 52, opp: 52 },
    ],
    filmWatched: false,
    film: "Ole Miss is no-huddle shotgun and Trinidad Chambliss. Stay home on him, cap the shot plays, and run the front — they go as he goes.",
    filmNotes: [
      "Ole Miss is no-huddle shotgun and Trinidad Chambliss. Stay home on him, cap the shot plays, and run the front — they go as he goes.",
      "Pure no-huddle shotgun. They play to score fast — 38.0 points and 445 yards a game, 27:11 time of possession. No under center vs LSU.",
      "Money downs: 46 percent on third, 2-for-3 on fourth-and-short, 12-for-12 in the red zone with 11 touchdowns.",
      "Chambliss is 70 percent, 924 yards, 7 TD, 2 INT. He will sit for the isolated shot and he will keep it. The winning score vs LSU was the 14-yard keep. He will hold it and he will throw it late.",
      "Traylon Ray is the isolated X — 7-115-1 vs LSU, 21-yard play-action over the top. Deuce Alexander is volume and the back-corner — two 62s vs Louisville, 20-yard TD on the run vs LSU. Caleb Odom (5-88) and Horatio Fields (5-52) work the middle.",
      "Kewan Lacy (39-191-4) is game-time with a left shoulder. JT Lindsey is next — fourth-and-1 and the two-point after the keep.",
      "Pete Golding's 4-2-5 can close a game (Franklin tip, Braxton INT) and bend in the red zone (3 touchdowns on 9 trips), but the front just gave LSU 172 and Louisville 162.",
      "Will Echoles anchors the interior. Blake Purchase is the edge. Suntarine Perkins is the hybrid. Louisville threw 307 when they got them in space.",
      "Start Baugh downhill. When they load the box, Philo goes over the top.",
      "Lucas Carneiro is 5-for-7 (48 walk-off, 53 miss). They will go for two after a keep.",
    ],
    pred: "UF 28 · Ole Miss 27",
    predUF: 28,
    predOpp: 27,
    opponentTendencies: [
      "Schematic identity: Pure no-huddle shotgun. They play to score fast, not bleed the clock — 27:11 time of possession.",
      "Efficiency: 38.0 points and 445 yards a game (331 pass / 114 rush) through three.",
      "Situational: 46 percent on third down, 2-for-3 on fourth-and-short, 12-for-12 in the red zone with 11 touchdowns.",
      "Trinidad Chambliss is the engine — 70 percent (77-of-110), 924 yards, 7 TD, 2 INT. He will sit and take the isolated shot, and he is lethal when the play breaks. vs LSU he threw the 20-yard back-corner TD on the run to Deuce Alexander and scored the winner himself on a 14-yard keep. He will hold it too long (20-yard sack vs LSU) and he will throw it if you force him past the first downfield read.",
      "You cannot bracket one wideout. Four cleared 50 vs LSU. Traylon Ray is the isolated X (7-115-1 vs LSU, 21-yard play-action over the top). Deuce Alexander is the volume chain-mover and scramble-drill target (two 62s vs Louisville; 7-60-1 vs LSU). Caleb Odom (5-88) and Horatio Fields (5-52) work the middle.",
      "The run is secondary. Kewan Lacy is the early-down and short-yardage back (39-191-4). Left shoulder vs LSU — game-time. JT Lindsey is next (4-20 vs LSU) — fourth-and-1 sneak and the two-point after the keep.",
    ],
    defenseTendencies: [
      "Schematic identity: Pete Golding's base is a 4-2-5 — four down, two linebackers, five DBs — with pre-snap disguise and DB versatility. Jaylon Braxton rotated safety and corner vs LSU.",
      "Pass rush is methodical, not overwhelming — 6 sacks and 14 hurries through three.",
      "They are allowing 24.0 points and 374 yards a game (215 pass / 159 rush).",
      "Red zone is bend-but-don't-break. Opponents scored on 8 of 9 trips inside the 20, but only 3 touchdowns — five field-goal attempts.",
      "The front has pursuit speed and will get combo-blocked downhill — Louisville ran for 162 and LSU ran for 172 (Dilin Jones 106). Will Echoles (6-3, 315) is the interior anchor. Blake Purchase is the edge closer. Tah'j Butler, Luke Ferrelli, and Keaton Thomas are the off-ball tacklers. Suntarine Perkins is the hybrid — edge, delayed blitz, or zone drop.",
      "The secondary can close a game. Kam Franklin tipped the fourth-and-goal that Jaylon Braxton intercepted to seal LSU. Sharif Denson had 8 tackles in his LSU debut. The hole is space — Louisville threw 307 when they stretched them horizontally.",
    ],
    specialTeams: [
      "Lucas Carneiro is 5-for-7 this season — hit from 37, missed from 53, and converted a 48-yard walk-off to beat Louisville.",
      "After a Chambliss keep they will chase two. JT Lindsey ran the two-point after the 14-yard winner vs LSU.",
    ],
    howUFWins: [
      "Do not allow Chambliss to comfortably sit in the pocket or break containment on scramble drills. Defensive ends must rush with contain equity — do not crash past his upfield shoulder. The edge defenders must play parallel to stay in the running lane on the QB keep.",
      "Eradicate the explosive chunk play. Do not bite on short hitch routes or play-action windows. Defensive backs must maintain depth over the top of Traylon Ray's vertical stems and respect Deuce Alexander on the back-corner extended plays.",
      "Ole Miss' front seven is vulnerable to a physical ground attack, having just surrendered 172 yards to LSU. Start Baugh to establish physical dominance early. Once Ole Miss is forced to over-rotate safeties down to load the box, unleash Philo to attack the single-high coverages over the top.",
    ],
    scoutingReport:
      "OLE MISS OFFENSE (official 3-game + ESPN LSU PBP sit): Pure no-huddle shotgun. 38.0 PPG, 445 YPG (331 pass / 114 rush), TOP 27:11, 46% 3rd, 2-3 4th, RZ 12-12 / 11 TD. Trinidad Chambliss is the engine (77/110, 924, 7 TD, 2 INT). Sit-and-shot + scramble + keep (winner left 14 vs LSU). Ray isolated X 7-115-1 LSU (21-yard play-action over the top). Deuce volume + back-corner (two 62s Louisville; 20 TD on the run vs LSU). Odom 5-88, Fields 5-52. Lacy 39-191-4 GTD left shoulder; Lindsey next (4-20, 4th-and-1, 2-pt). John David Baker calls it — not Lane Kiffin (LSU 2026). OLE MISS DEFENSE (Pete Golding HC still calls D, base 4-2-5): 24.0 PPG, 374 YPG (215 pass / 159 rush). 6 sacks, 14 QBH. RZ 8-9 scores / 3 TDs. Front hole: Louisville 162, LSU 172 (Jones 106). Echoles interior, Purchase edge, Butler/Ferrelli/Thomas off-ball, Perkins hybrid. Secondary can close (Franklin tip, Braxton INT) and gets picked in space (Louisville 307). Coverage shells NOT confirmed on PBP. UF wins: Maintain Lane Discipline & Crowd Chambliss / Cap the Vertical Shots / Establish the Downhill Run Game. filmWatched: false.",
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
    ufPct: 48,
    tv: "TBD",
    keys: ["Establish run on road", "Win turnover battle", "Execute red zone"],
    swing: [
      { name: "Jaden Baugh", impact: 95, role: "Physical run game" },
      { name: "Secondary", role: "Limit deep shots" },
    ],
    film: "Missouri uses RPO and play-action.",
    pred: "UF 24 · Missouri 27",
    predUF: 24,
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
    ufPct: 68,
    tv: "TBD",
    keys: ["Win rivalry week", "Control clock", "Limit their QB run game"],
    swing: [
      { name: "Edge defenders", role: "Contain QB run" },
      { name: "Singleton Jr.", role: "Win one-on-ones" },
    ],
    film: "Homecoming vs South Carolina. RPO-heavy.",
    pred: "UF 31 · South Carolina 20",
    predUF: 31,
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
    ufPct: 36,
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
    ufPct: 37,
    tv: "ABC",
    keys: ["Control time of possession", "Get pressure on their QB", "Establish run before going downfield"],
    swing: [
      { name: "Jadan Baugh", impact: 95, role: "Must go 100+ yards" },
      { name: "Jayden Woods", role: "Must generate pressure" },
    ],
    film: "Neutral-site Cocktail Party at Mercedes-Benz Stadium in Atlanta for 2026.",
    pred: "UF 20 · Georgia 28",
    predUF: 20,
    predOpp: 28,
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
    ufPct: 57,
    tv: "TBD",
    keys: ["Win early downs", "Protect the football", "Limit explosives"],
    swing: [
      { name: "QB1", role: "Pace vs SEC-speed pressure" },
      { name: "Secondary", role: "Match skill in space" },
    ],
    film: "Oklahoma brings tempo and skill. Swamp night energy matters.",
    pred: "UF 28 · Oklahoma 24",
    predUF: 28,
    predOpp: 24,
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
    ufPct: 56,
    tv: "TBD",
    keys: ["Physical run fits", "Win the trenches", "Finish in red zone"],
    swing: [
      { name: "Jadan Baugh", impact: 95, role: "Wear down front" },
      { name: "WR room", role: "Explosive plays" },
    ],
    film: "Kentucky power run and play-action on the road.",
    pred: "UF 27 · Kentucky 24",
    predUF: 27,
    predOpp: 24,
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
    ufPct: 68,
    tv: "TBD",
    keys: ["Execute early", "Avoid complacency", "Develop depth"],
    swing: [
      { name: "Backup units", role: "Rep evaluation" },
      { name: "QB1", role: "Efficient scoring drives" },
    ],
    film: "Vanderbilt improving — treat as SEC test.",
    pred: "UF 28 · Vanderbilt 24",
    predUF: 28,
    predOpp: 24,
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
    ufPct: 63,
    tv: "ABC",
    keys: ["Win field position battle", "Avoid penalties", "Win turnover margin"],
    swing: [
      { name: "QB1", role: "Composure in hostile environment" },
      { name: "Myles Graham", role: "Contain their TE weapon" },
    ],
    film: "Everything on the line. UF takes Doak — finish drives and win the turnover battle.",
    pred: "UF 30 · FSU 24",
    predUF: 30,
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
