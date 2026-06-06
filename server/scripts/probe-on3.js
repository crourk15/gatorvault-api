const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const pageUrl = 'https://www.on3.com/college/florida-gators/football/2027/commits/';

async function main() {
  const res = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const next = JSON.parse(m[1]);
  const pp = next.props.pageProps;
  fs.writeFileSync(path.join(__dirname, '..', 'on3-sample.json'), JSON.stringify(pp, null, 2));

  console.log('playerList type', Array.isArray(pp.playerList) ? 'array' : typeof pp.playerList);
  if (Array.isArray(pp.playerList)) {
    console.log('playerList length', pp.playerList.length);
    console.log('first keys', Object.keys(pp.playerList[0] || {}));
    console.log('first name', pp.playerList[0]?.name || pp.playerList[0]?.fullName);
  } else if (pp.playerList) {
    console.log('playerList keys', Object.keys(pp.playerList));
    const list = pp.playerList.list || pp.playerList.players || pp.playerList.items;
    console.log('nested list len', list?.length);
    if (list?.[0]) console.log('nested first keys', Object.keys(list[0]));
  }
  console.log('teamRank', JSON.stringify(pp.teamRank).slice(0, 400));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
