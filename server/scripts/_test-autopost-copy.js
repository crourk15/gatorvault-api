const copy = require('../lib/x-autoposter-copy');
const fill = require('../lib/x-autoposter-fill');

async function main() {
  const ev = {
    id: 'evt_test',
    eventType: 'commit',
    source: 'on3',
    playerSlug: 'armani-strong',
    skinny: '4⭐ WR Armani Strong has committed to Florida.',
    detail: 'Armani Strong committed to Florida (2026-06-28).',
    createdAt: new Date().toISOString(),
    payload: {
      player: {
        name: 'Armani Strong',
        slug: 'armani-strong',
        pos: 'WR',
        stars: 4,
        classYear: 2028,
        school: 'Chaminade-Madonna Prep, FL',
        on3Id: '284115',
        committedTo: 'Florida',
        commitDate: '2026-06-28',
      },
    },
  };
  const built = await copy.buildRecruitingEventCopyAsync(ev, { source: 'On3' });
  console.log('built', built ? built.text : null);
  const raw = await fill.buildNewsFromEvent(ev);
  console.log('news', raw ? raw.text : null);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
