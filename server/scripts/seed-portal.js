/**
 * Seed incoming portal transfers with On3-sourced profiles.
 * Run: node scripts/seed-portal.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { upsertPlayer } = require('../lib/recruiting-store');
const { slugify } = require('../lib/slug');

const portalIncoming = [
  { name: 'Eric Singleton Jr.', pos: 'WR', from: 'Auburn', htWt: '6-2 / 185', stars: 4, on3Id: '155719', status: 'enrolled',
    skinny: 'On3: Auburn transfer and immediate WR1 — led the Tigers in receiving production before entering the portal.',
    profileNote: 'Vertical threat who projects as Florida\'s top outside receiver and red-zone weapon in Year 1.' },
  { name: 'Aaron Philo', pos: 'QB', from: 'Georgia Tech', htWt: '6-3 / 210', stars: 3, on3Id: '146069', status: 'enrolled',
    skinny: 'On3: Georgia Tech transfer with a 47% third-down conversion rate — pro-style distributor in the QB battle.',
    profileNote: 'Rhythm passer with anticipatory throwing; fits Robby Faulkner\'s RPO-heavy offense if the OL protects.' },
  { name: 'Harrison Moore', pos: 'C', from: 'Georgia Tech', htWt: '6-3 / 300', stars: 3, on3Id: '153739', status: 'enrolled',
    skinny: 'On3: Georgia Tech OL transfer slotted as Florida\'s starting center for 2026.',
    profileNote: 'Anchors the rebuilt interior of a five-new-starter offensive line.' },
  { name: 'Eagan Boyer', pos: 'LT', from: 'Penn State', htWt: '6-5 / 305', stars: 3, on3Id: '155795', status: 'enrolled',
    skinny: 'On3: Penn State tackle transfer — 6-8 frame adds length and pass-pro upside on the blind side.',
    profileNote: 'Projects as backup tackle with starting upside if the right side needs shuffling.' },
  { name: 'TJ Shanahan Jr.', pos: 'RG', from: 'Penn State', htWt: '6-4 / 315', stars: 3, on3Id: '113148', status: 'enrolled',
    skinny: 'On3: Penn State IOL transfer in a dead heat with Bryce Lovett for the starting RG job.',
    profileNote: 'Experienced Power 5 guard with starting reps at Penn State.' },
  { name: 'Evan Pryor', pos: 'RB', from: 'Cincinnati', htWt: '5-10 / 195', stars: 3, on3Id: '43376', status: 'enrolled',
    skinny: 'On3: Cincinnati transfer adds pass-catching and change-of-pace behind Jadan Baugh.',
    profileNote: 'Third-down and receiving back who complements the workhorse starter.' },
  { name: 'Luke Harpring', pos: 'TE', from: 'Georgia Tech', htWt: '6-5 / 245', stars: 3, on3Id: '178849', status: 'enrolled',
    skinny: 'On3: Georgia Tech TE transfer — inline blocker with intermediate route ability.',
    profileNote: 'Depth behind Lacota Dippre in the Y tight end room.' },
  { name: 'Cam Dooley', pos: 'S', from: 'Kentucky', htWt: '6-1 / 205', stars: 3, on3Id: '178263', status: 'enrolled',
    skinny: 'On3: Kentucky safety transfer who adds range and tackling in Brad White\'s secondary.',
    profileNote: 'Rotates at FS and fits the 3-3-5 hybrid package.' },
  { name: 'DJ Coleman', pos: 'S', from: 'Baylor', htWt: '6-2 / 210', stars: 3, on3Id: '150237', status: 'enrolled',
    skinny: 'On3: Baylor DB transfer — veteran nickel who rotates at STAR behind Kanye Clark.',
    profileNote: 'Press-man experience at a premium niche spot in the 3-3-5.' },
  { name: 'Patrick Durkin', pos: 'K', from: 'Tulane', htWt: '6-1 / 195', stars: 3, on3Id: '162609', status: 'enrolled',
    skinny: 'On3: Tulane kicker transfer won Florida\'s placekicking job in spring.',
    profileNote: 'Special teams upgrade with Power 5 experience.' },
  { name: 'Lacota Dippre', pos: 'TE', from: 'James Madison', htWt: '6-4 / 240', stars: 3, on3Id: '162020', status: 'enrolled',
    skinny: 'On3: James Madison TE transfer — starting Y tight end with vertical threat upside.',
    profileNote: 'Legitimate weapon when deployed vertically in Faulkner\'s offense.' },
  { name: 'Bailey Stockton', pos: 'WR', from: 'Georgia Tech', htWt: '5-9 / 175', stars: 3, on3Id: '154828', status: 'enrolled',
    skinny: 'On3: Georgia Tech slot receiver transfer — quick-twitch separator in the middle of the field.',
    profileNote: 'Slot weapon who complements Singleton and Vernell Brown in 11 personnel.' },
  { name: 'DK Kalu', pos: 'DL', from: 'Baylor', htWt: '6-3 / 270', stars: 3, on3Id: '145026', status: 'enrolled',
    skinny: 'On3: Baylor defensive lineman transfer slotted as nose backup in the 3-3-5.',
    profileNote: 'Rotational nose who eats double teams in the three-down front.' },
  { name: 'Alec Clark', pos: 'P', from: 'Tulane', htWt: '6-1 / 184', stars: 3, on3Id: '283676', status: 'enrolled',
    skinny: 'On3: Tulane punter transfer — Australian-born leg who handles starting punts.',
    profileNote: 'Field-position weapon with directional punting ability.' },
  { name: 'Emmanuel Oyebadejo', pos: 'DL', from: 'Jacksonville State', htWt: '6-7 / 315', stars: 3, on3Id: '239636', status: 'enrolled',
    skinny: 'On3: Jacksonville State DL transfer — England native with a rare 6-7, 315-pound frame.',
    profileNote: 'Developmental edge/nose with size the SEC front can develop.' },
  { name: 'London Montgomery', pos: 'RB', from: 'East Carolina', htWt: '5-10 / 185', stars: 3, on3Id: '147775', status: 'enrolled',
    skinny: 'On3: East Carolina RB transfer — kick return specialist and depth back.',
    profileNote: 'KR1 option with burst in space on special teams.' },
  { name: 'Carter Milliron', pos: 'LS', from: 'Louisiana', htWt: '6-0 / 257', stars: 3, on3Id: '283756', status: 'enrolled',
    skinny: 'On3: Louisiana long snapper transfer — won the starting LS role.',
    profileNote: 'Special teams reliability on punts and field goals.' },
  { name: 'Miller Fealy', pos: 'P', from: 'UT Martin', htWt: '6-2 / 210', stars: 3, on3Id: '283795', status: 'enrolled',
    skinny: 'On3: UT Martin punter transfer — backup punter with Australian punting background.',
    profileNote: 'Insurance at punter behind Alec Clark.' },
  { name: 'TJ Bullard', pos: 'LB', from: 'UCF', htWt: '6-1 / 200', stars: 3, on3Id: '113075', status: 'enrolled',
    skinny: 'On3: UCF linebacker transfer — adds depth and speed in the second level.',
    profileNote: 'Developmental LB in the 3-3-5\'s five-linebacker look.' },
  { name: 'Jaylen Lloyd', pos: 'WR', from: 'Oklahoma State', htWt: '5-11 / 180', stars: 3, on3Id: '154954', status: 'enrolled',
    skinny: 'On3: Oklahoma State WR transfer — speed element in the receiver room.',
    profileNote: 'Depth receiver with home-run speed for vertical shots.' },
  { name: 'Mason Clinton', pos: 'DL', from: 'Mississippi State', htWt: '6-5 / 265', stars: 3, on3Id: '175643', status: 'enrolled',
    skinny: 'On3: Mississippi State DL transfer — rotational tackle in the three-down front.',
    profileNote: 'Adds interior depth behind Brendan Bett and the ends.' },
  { name: 'Evan Chieca', pos: 'TE', from: 'New Haven', htWt: '6-5 / 250', stars: 3, on3Id: '283144', status: 'enrolled',
    skinny: 'On3: New Haven TE transfer — backup Y tight end with blocking-first profile.',
    profileNote: 'Depth at TE behind Lacota Dippre.' },
  { name: 'Jordy Lowery', pos: 'CB', from: 'East Carolina', htWt: '5-11 / 167', stars: 3, on3Id: '66322', status: 'enrolled',
    skinny: 'On3: East Carolina CB transfer — slot corner depth behind McClain and Johnson.',
    profileNote: 'Coverage depth in a secondary heavy on transfer additions.' },
  { name: 'Ace Ciongoli', pos: 'WR', from: 'Indiana', htWt: '5-11 / 190', stars: 3, on3Id: '284197', status: 'enrolled',
    skinny: 'On3: Indiana WR transfer — reliable hands at the catch point in the slot.',
    profileNote: 'Late-cycle add who gives the WR room another route-runner.' }
];

async function main() {
  console.log('Seeding', portalIncoming.length, 'incoming portal transfers…');
  for (const p of portalIncoming) {
    await upsertPlayer({
      slug: slugify(p.name),
      name: p.name,
      pos: p.pos,
      classYear: null,
      school: p.from,
      htWt: p.htWt,
      stars: p.stars,
      category: 'portal',
      status: p.status || 'enrolled',
      committedTo: 'Florida',
      fromSchool: p.from,
      skinny: p.skinny,
      profileNote: p.profileNote,
      on3Id: p.on3Id,
      starsDisplay: '★'.repeat(Math.min(5, p.stars || 3))
    });
    console.log('  ✓', p.name);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
