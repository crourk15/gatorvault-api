/** PR-5 golden beat fixtures — production-shaped signals for regression tests. */

const GOLDEN_BEATS = [
  {
    id: 'drakeford',
    player: { name: 'Ryan Drakeford', pos: 'S', classYear: 2028, school: 'GA' },
    beatText:
      'Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp. "Florida is one of those schools at the top of my board."',
    metrics: { rpm: null, visitDate: null, compSchools: [], depthChartNote: null, schemeNote: null }
  },
  {
    id: 'robinson',
    player: { name: 'Man Robinson', pos: 'CB', classYear: 2028, school: 'GA' },
    beatText:
      'Man Robinson says Florida has all three of their DB coaches texting him — and after his first visit to Gainesville, the Gators cracked his early leaderboard.',
    metrics: { rpm: null, visitDate: null, compSchools: [], depthChartNote: null, schemeNote: null }
  },
  {
    id: 'woodrow',
    player: { name: 'Rhys Woodrow', pos: 'WR', classYear: 2027, school: 'FL' },
    beatText:
      'Rhys Woodrow told On3 that Florida stands out for a specific reason after his Friday Night Lights visit — what was different about Gainesville compared to Ohio State and Miami.',
    metrics: { rpm: 42, visitDate: '2026-06-14', compSchools: ['Ohio State', 'Miami'], depthChartNote: null, schemeNote: null }
  },
  {
    id: 'kalu',
    player: { name: 'DK Kalu', pos: 'DL', classYear: 2026, school: 'TX' },
    beatText:
      "DK Kalu didn't need an offer from Florida to know the Gators were serious — staff contact picked up after his on-campus visit this spring.",
    metrics: { rpm: null, visitDate: null, compSchools: [], depthChartNote: null, schemeNote: null }
  },
  {
    id: 'fleming',
    player: { name: 'Joey Fleming', pos: 'IOL', classYear: 2028, school: 'FL' },
    beatText:
      '"100 percent." That was Joey Fleming\'s answer when asked if another trip to Gainesville could happen soon. The nation\'s No. 1 interior OL details his strong interest in the Gators.',
    metrics: { rpm: 38, visitDate: '2026-07-12', compSchools: ['Georgia'], depthChartNote: null, schemeNote: null }
  },
  {
    id: 'ham',
    player: { name: 'Merrick Ham', pos: 'EDGE', classYear: 2028, school: 'Marietta' },
    beatText:
      'Four-star 2028 EDGE Merrick Ham was on campus at Florida in early March. He appreciated the energy from the staff while on campus, and he\'s only seen more of that since June 15. "I loved the energy that I saw."',
    metrics: {
      rpm: null,
      visitDate: '2026-03-08',
      compSchools: [],
      rpmTop: [
        { school: 'Auburn', pct: 21 },
        { school: 'Vanderbilt', pct: 18 }
      ],
      depthChartNote: null,
      schemeNote: null
    }
  },
  {
    id: 'zylen',
    player: { name: 'Zylen Little', pos: 'EDGE', classYear: 2027, school: 'GA' },
    beatText: 'Zylen Little (2027 EDGE) has been on campus multiple times this spring. Florida is firmly in the mix.',
    metrics: { rpm: 51, visitDate: null, compSchools: ['Georgia'], depthChartNote: null, schemeNote: null }
  },
  {
    id: 'willingham',
    player: { name: 'Bryce Willingham', pos: 'CB', classYear: 2028, school: 'GA' },
    beatText:
      'Florida has given 2028 CB Bryce Willingham a lot to like as of late. He was on campus this spring to watch the Gators in spring practice, and they are in a strong position early on with the cornerback out of Atlanta. "Definitely one of my top schools."',
    metrics: { rpm: null, visitDate: null, compSchools: [], depthChartNote: null, schemeNote: null }
  }
];

function toSignal(beat) {
  return {
    type: 'recruiting',
    player: beat.player,
    beatText: beat.beatText,
    event: { description: beat.beatText, kind: 'visit', source: 'Beat writer' },
    metrics: beat.metrics || {},
    links: { playerUrl: `https://gatorvaultinsider.com/vault/futurecast/player/${beat.id}` }
  };
}

module.exports = {
  GOLDEN_BEATS,
  toSignal
};
