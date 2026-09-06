/**
 * GatorVault Film Review — weekly authored Florida game board.
 * Breakdowns stay GNFP / Film Guy. This rail is our voice.
 *
 * Watch standard: official floridagators.com play-by-play is charted snap-by-snap.
 * Do not call coverage shells or All-22 looks unless a broadcast / Hudl watch lands.
 */

export type FilmReviewWatchStandard = 'official-pbp' | 'broadcast' | 'all22';

export type FilmReviewUnitId = 'offense' | 'defense' | 'specials';

export type FilmReviewUnit = {
  kicker: string;
  body: string;
  bullets: string[];
};

export type VaultFilmReview = {
  id: string;
  week: number;
  season: number;
  gameId: string;
  opponent: string;
  opponentShort: string;
  dateLabel: string;
  venue: string;
  finalUF: number;
  finalOpp: number;
  title: string;
  dek: string;
  filmWatched: boolean;
  watchStandard: FilmReviewWatchStandard;
  watchNote: string;
  sources: { label: string; url?: string }[];
  headline: string;
  offense: FilmReviewUnit;
  defense: FilmReviewUnit;
  specials: FilmReviewUnit;
  keys: string[];
  schemeLessonIds: string[];
  nextWeek: { opponent: string; look: string };
  clipLabel?: string;
  clipUrl?: string;
  publishedAt: string;
};

export const VAULT_REVIEW_HUB = 'GatorVault Review';

export const VAULT_FILM_REVIEWS: VaultFilmReview[] = [
  {
    id: 'week-1-fau',
    week: 1,
    season: 2026,
    gameId: 'fau',
    opponent: 'Florida Atlantic',
    opponentShort: 'FAU',
    dateLabel: 'September 5, 2026',
    venue: 'Ben Hill Griffin Stadium',
    finalUF: 66,
    finalOpp: 21,
    title: 'Week 1 vs FAU',
    dek: 'Philo and Baugh ran the table. White’s front got the ball back. The Owls still moved it.',
    filmWatched: true,
    watchStandard: 'official-pbp',
    watchNote:
      'Official floridagators.com play-by-play charted snap-by-snap. Broadcast and All-22 were not this desk. Coverage shells are not called.',
    sources: [
      {
        label: 'Official box + play-by-play',
        url: 'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903',
      },
      {
        label: 'Official recap — Chris Harry',
        url: 'https://floridagators.com/news/2026/9/5/football-final-florida-vs-florida-atlantic-sept-5-2026',
      },
      {
        label: 'Sumrall Sunday notes',
        url: 'https://floridagators.com/news/2026/9/6/football-gators-a-good-opener-for-gators-under-sumrall',
      },
    ],
    headline:
      'Florida 66, FAU 21. Seven touchdown drives of 75-plus. Two takeaways. The Owls still piled 396 yards on 90 plays.',
    offense: {
      kicker: 'Faulkner · no-huddle shotgun',
      body:
        'Every Florida snap on the official chart is No Huddle-Shotgun. Philo opened from the 6 after Coleman’s interception and needed seven plays to go 94. Baugh hit 9 and 8 on the first two carries. Wilson’s 19-yard catch on 2nd-and-12 put them on the FAU 49. Brown caught the next ball at midfield and walked it in — 49 yards, first Gator score of the Sumrall era. The next series started at the FAU 48 after an 18-yard punt. Baugh took the left edge for 18. Stockton finished it from 12. That is the Faulkner menu in one possession: run to set the throw, throw to finish.\n\nThe vertical showed up on the next scoring drive. Abrams won deep right for 63 to the FAU 8. Florida then lost 20 on a wild snap, Baugh saved 3rd-and-28 with 25 to the 3, and Philo scored on 4th-and-3. Do not dress that up as scheme. That is a mistake and a back who wins anyway.\n\nBaugh finished 14-160-3, including the 61-yard burst on 3rd-and-2 to open the second half. Clark spelled him and scored receiving and rushing. Jones Jr. closed it 4-of-5 for 68 and a 6-yard touchdown to Micah Jones. Philo’s night: 16-of-21, 275, three throw scores, one rushing score, one interception. 624 yards as a team. 343 through the air, 281 on the ground.',
      bullets: [
        'Philo 16-of-21, 275, 3 pass TD, 1 rush TD, 1 INT — Brown 49 and Stockton 12 before the first FAU score.',
        'Baugh 14-160-3. The 61-yard 3rd-and-2 and the 25-yard save on 3rd-and-28 are the tape you keep.',
        'Abrams 63-yard shot. Wilson chain-moving. Brown 6-117 and the first score of his career.',
        'Every UF snap charted: no huddle, shotgun. No under-center look on the official play-by-play.',
        'Jones Jr. two series, 4-of-5, 68, touchdown to Micah Jones. Clark 65 rush and a 10-yard score from Philo.',
      ],
    },
    defense: {
      kicker: 'White · takeaways, then the long drives',
      body:
        'FAU won the toss and went no-huddle shotgun from the first snap. The first play was a Messer throw, hurried by Clark. Veltkamp then dinked to the Florida 35. On 3rd-and-10 Coleman jumped the ball at the 5. That is the start you want. Dijon Johnson’s interception on the first snap after Baugh’s 12-yard score was the next one — one play, zero yards, Baugh in from 7 three snaps later.\n\nThe problem is the drives they did not get off the field. FAU’s first touchdown was 13 plays, 75 yards, two fourth-down conversions, Veltkamp keeping for 7 to the 1, Ervin finishing. The second was 12 plays, 78 yards, Veltkamp again from 7. The third was 9 plays, 75, Valsin from 20. Official box: 396 yards, 25 first downs, 11-of-their third downs, Veltkamp 34-of-52 for 276, one rushing score, one throwing score, two interceptions. Sumrall said the defense was atrocious at times. The chart backs him. Ninety plays. You cannot live there in SEC weeks.\n\nThe stops that matter for Campbell: Coleman and Johnson with the takeaways, McCloud breaking up 4th-and-2 before half, James stuffing 4th-and-4 at the gun, Bett and McCloud holding the 4th-and-1 to a yard and then James sacking Veltkamp into a fumble FAU recovered. Fourth-down stops are on the sheet. Coverage shells are not.',
      bullets: [
        'Coleman INT at the Florida 5 on the opening series. Johnson INT on the first snap after Baugh’s 12-yard score.',
        'FAU: no-huddle shotgun every snap charted. Veltkamp 34-of-52, 276, 1 pass TD, 1 rush TD, 2 INT.',
        'Three FAU touchdown drives of 75-plus. 396 yards, 25 first downs, 90 plays. Sumrall called it atrocious at times.',
        'McCloud PBU on 4th-and-2. James stuffs 4th-and-4 at the half. Bett / McCloud live on the 4th-and-1.',
        'Coverage calls are not on this board. Hurries from Clark, Bett, McCloud, Oyebadejo, Chiles are.',
      ],
    },
    specials: {
      kicker: 'Durkin · hidden yards',
      body:
        'Durkin’s 53-yarder made it 17-0 and was the only Florida possession that did not finish in the end zone in the first half. Kickoffs were touchbacks until Henry returned one 21 yards. Chandley’s 18-yard punt set up Stockton. FAU delay-of-game and unsportsmanlike piled 88 penalty yards against 32 for Florida. Brown fair-caught the 47-yarder. No return game to grade. The kicking operation (Durkin / Clark / Anderson) was clean on the official chart.',
      bullets: [
        'Durkin 53-yard field goal — Florida’s only non-touchdown scoring drive before the half.',
        'FAU 18-yard punt to the Owls’ 48. Stockton scored three plays later.',
        'FAU 88 penalty yards, Florida 32. Hidden field position helped Faulkner stay on schedule.',
      ],
    },
    keys: [
      'Baugh on early downs and on the money downs — 3rd-and-28 and 3rd-and-2 both became Florida scores.',
      'Philo’s first-read answers (Brown, Stockton, Abrams) before FAU could load the box.',
      'Get off the field on third and fourth. Ninety Owl plays is the number White has to kill this week.',
    ],
    schemeLessonIds: ['ss-rpo-quick', 'ss-gap-run', 'ss-wr-spacing', 'ss-qb-progression', 'ss-run-fits'],
    nextWeek: {
      opponent: 'Campbell',
      look: 'Sixkiller will throw it and keep it. Do not give him the 90-play night Veltkamp just had. Finish drives the way Baugh finished these.',
    },
    clipLabel: 'Official scoring + play-by-play',
    clipUrl: 'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903',
    publishedAt: '2026-09-06T16:00:00-04:00',
  },
];

export function vaultFilmReview(id: string): VaultFilmReview | undefined {
  return VAULT_FILM_REVIEWS.find((review) => review.id === id);
}

export function latestVaultFilmReview(): VaultFilmReview | undefined {
  return [...VAULT_FILM_REVIEWS].sort((a, b) => {
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    return tb - ta;
  })[0];
}

export function vaultFilmReviewForGame(gameId: string): VaultFilmReview | undefined {
  return VAULT_FILM_REVIEWS.find((review) => review.gameId === gameId);
}

export function vaultReviewHref(reviewId?: string): string {
  const id = reviewId || latestVaultFilmReview()?.id;
  const base = '/vault/film-room/review';
  return id ? `${base}?review=${encodeURIComponent(id)}` : base;
}

export function watchStandardLabel(standard: FilmReviewWatchStandard): string {
  if (standard === 'all22') return 'All-22 watched';
  if (standard === 'broadcast') return 'Broadcast watched';
  return 'Official PBP charted';
}
