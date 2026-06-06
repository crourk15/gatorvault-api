/**
 * Seed recruiting JSON store from GatorVault static data (Phase 1).
 * Run: node scripts/seed-recruiting.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const {
  upsertPlayer,
  upsertRanking,
  DATA_DIR
} = require('../lib/recruiting-store');
const { slugify } = require('../lib/slug');
const fs = require('fs');

const class2026 = [
  { name: 'Davian Groce', pos: 'WR', school: 'Milton HS, Alpharetta GA', htWt: '6-1 / 180', stars: 4, status: 'Enrolled' },
  { name: 'CJ Bronaugh', pos: 'CB', school: 'Lakewood HS, St. Petersburg FL', htWt: '6-0 / 175', stars: 4, status: 'Enrolled' },
  { name: 'Kevin Ford', pos: 'EDGE', school: 'Highland Springs HS, VA', htWt: '6-4 / 235', stars: 4, status: 'Enrolled' },
  { name: 'Justin Williams', pos: 'WR', school: 'Buchholz HS, Gainesville FL', htWt: '6-2 / 190', stars: 4, status: 'Enrolled' },
  { name: 'JaReylan McCoy', pos: 'DL', school: 'Cedar Grove HS, Ellenwood GA', htWt: '6-3 / 280', stars: 4, status: 'Enrolled' },
  { name: 'Dylan Purter', pos: 'S', school: 'Miami Central HS, Miami FL', htWt: '6-1 / 195', stars: 4, status: 'Enrolled' },
  { name: 'Will Griffin', pos: 'QB', school: 'Plant HS, Tampa FL', htWt: '6-3 / 210', stars: 4, status: 'Enrolled' },
  { name: 'Kendall Guervil', pos: 'DL', school: 'Lehigh HS, Fort Myers FL', htWt: '6-4 / 270', stars: 4, status: 'Enrolled' },
  { name: 'Tyler Chukuyem', pos: 'OT', school: 'Narbonne HS, Harbor City CA', htWt: '6-6 / 300', stars: 4, status: 'Enrolled' },
  { name: 'Malik Morris', pos: 'LB', school: 'Apopka HS, Apopka FL', htWt: '6-2 / 225', stars: 4, status: 'Enrolled' },
  { name: 'Heze Kent', pos: 'OT/TE', school: 'Venice HS, Venice FL', htWt: '6-5 / 260', stars: 4, status: 'Enrolled' },
  { name: 'Marquez Daniel', pos: 'WR', school: 'Edgewater HS, Orlando FL', htWt: '5-11 / 175', stars: 4, status: 'Enrolled' },
  { name: 'Kaiden Hall', pos: 'S', school: 'St. Thomas Aquinas, Fort Lauderdale FL', htWt: '6-1 / 200', stars: 4, status: 'Enrolled' },
  { name: 'Duke Clark', pos: 'RB', school: 'Armwood HS, Seffner FL', htWt: '5-11 / 200', stars: 4, status: 'Enrolled' },
  { name: "G'Nivre Carr", pos: 'OL', school: 'Osceola HS, Kissimmee FL', htWt: '6-4 / 310', stars: 4, status: 'Enrolled' },
  { name: 'Corey Brown', pos: 'OL', school: 'Dillard HS, Fort Lauderdale FL', htWt: '6-4 / 305', stars: 3, status: 'Enrolled' },
  { name: 'Desmond Green', pos: 'OL', school: 'Vero Beach HS, Vero Beach FL', htWt: '6-3 / 300', stars: 3, status: 'Enrolled' },
  { name: 'Javarii Luckas', pos: 'OT', school: 'Dunbar HS, Fort Myers FL', htWt: '6-5 / 295', stars: 3, status: 'Enrolled' },
  { name: 'Micah Jones', pos: 'TE', school: 'Sandalwood HS, Jacksonville FL', htWt: '6-4 / 230', stars: 3, status: 'Enrolled' },
  { name: 'Byron Louis', pos: 'RB', school: 'Dr. Phillips HS, Orlando FL', htWt: '5-10 / 195', stars: 3, status: 'Enrolled' },
  { name: 'Jalen Wiggins', pos: 'EDGE', school: 'Mainland HS, Daytona Beach FL', htWt: '6-3 / 220', stars: 3, status: 'Enrolled' },
  { name: 'Jaylen Jordan', pos: 'TE', school: 'Hilliard FL', htWt: '6-6 / 240', stars: 3, status: 'Committed' },
  { name: 'Ace Ciongoli', pos: 'WR', school: "St. Sebastian's, Needham MA", htWt: '5-11 / 190', stars: 3, status: 'Enrolled' }
];

const class2027 = [
  { name: 'Kennedee Jackson', pos: 'OT', school: 'Lithonia (Lithonia, GA)', htWt: '6-5.5 / 301', stars: 4, rating: '91.77', natl: 139, posRk: 14, stRk: 14, date: '06/02/26', inState: false },
  { name: "Ja'Bios Smith", pos: 'LB', school: 'Swainsboro (Swainsboro, GA)', htWt: '6-2 / 205', stars: 4, rating: '91.78', natl: 138, posRk: 11, stRk: 13, date: '05/29/26', inState: false },
  { name: 'Elias Pearl', pos: 'WR', school: 'Port Charlotte (Port Charlotte, FL)', htWt: '5-11 / 183', stars: 4, rating: '92.47', natl: 95, posRk: 17, stRk: 11, date: '05/19/26', inState: true },
  { name: 'Peyton Miller', pos: 'IOL', school: 'Anna (Anna, TX)', htWt: '6-5 / 290', stars: 4, rating: '91.85', natl: 130, posRk: 10, stRk: 17, date: '04/27/26', inState: false },
  { name: "De'Voun Kendrick", pos: 'DL', school: 'Carrollwood Day (Tampa, FL)', htWt: '6-4 / 300', stars: 3, rating: '87.70', natl: 555, posRk: 59, stRk: 45, date: '04/27/26', inState: true },
  { name: 'Tommy Douglas', pos: 'TE', school: 'Hun School (Princeton, NJ)', htWt: '6-4.5 / 235', stars: 4, rating: '89.33', natl: 343, posRk: 19, stRk: 7, date: '04/16/26', inState: false },
  { name: 'Aamaury Fountain', pos: 'CB', school: 'Northside (Warner Robins, GA)', htWt: '6-3 / 182', stars: 4, rating: '91.80', natl: 133, posRk: 18, stRk: 12, date: '04/11/26', inState: false },
  { name: 'Davin Davidson', pos: 'QB', school: 'Cardinal Mooney (Sarasota, FL)', htWt: '6-6 / 215', stars: 4, rating: '92.19', natl: 113, posRk: 9, stRk: 13, date: '04/09/26', inState: true },
  { name: 'Maxwell Hiller', pos: 'IOL', school: 'Coatesville (Coatesville, PA)', htWt: '6-5.5 / 305', stars: 5, rating: '98.54', natl: 3, posRk: 1, stRk: 1, date: '04/08/26', inState: false, skinny: 'The #3 player nationally. Program-defining interior OL anchor for the 2027 class.' },
  { name: 'Anthony Jennings', pos: 'WR', school: 'Dillard (Fort Lauderdale, FL)', htWt: '5-11 / 160', stars: 4, rating: '89.99', natl: 294, posRk: 45, stRk: 25, date: '04/25/26', inState: true },
  { name: 'Andrew Beard', pos: 'RB', school: 'Prince Avenue Christian (Bogart, GA)', htWt: '5-9 / 195', stars: 4, rating: '91.37', natl: 166, posRk: 9, stRk: 18, date: '05/08/26', inState: false },
  { name: 'Elijah Hutcheson', pos: 'OT', school: 'North Cross School (Roanoke, VA)', htWt: '6-6 / 255', stars: 4, rating: '92.69', natl: 91, posRk: 7, stRk: 2, date: '05/05/26', inState: false },
  { name: 'Kailib Dillard', pos: 'S', school: 'Jenks (Tulsa, OK)', htWt: '6-2 / 170', stars: 3, rating: '88.02', natl: 497, posRk: 44, stRk: 12, date: '05/05/26', inState: false },
  { name: 'Stive-Bentley Keumajou', pos: 'DL', school: 'Coral Gables Senior (Coral Gables, FL)', htWt: '6-2.5 / 295', stars: 3, rating: '88.03', natl: 496, posRk: 52, stRk: 40, date: '05/06/26', inState: true },
  { name: "Tra'Von Hall", pos: 'WR', school: 'Oklahoma commit', htWt: '—', stars: 4, rating: null, natl: null, posRk: null, stRk: null, date: null, inState: false, category: 'target', status: 'target', skinny: 'Oklahoma commit visited Gainesville May 30-31. Top flip candidate.' },
  { name: 'Tramond Collins', pos: 'WR', school: 'Cottondale (Cottondale, FL)', htWt: '6-0 / 185', stars: 4, rating: '92.07', natl: 115, posRk: 20, stRk: 14, date: '03/11/26', inState: true },
  { name: 'Jackson Ballinger', pos: 'TE', school: 'Centerburg (Centerburg, OH)', htWt: '6-5 / 230', stars: 4, rating: '88.70', natl: 409, posRk: 25, stRk: 16, date: '02/24/26', inState: false },
  { name: 'Amare Nugent', pos: 'CB', school: 'American Heritage (Plantation, FL)', htWt: '5-11 / 180', stars: 4, rating: '90.63', natl: 233, posRk: 26, stRk: 21, date: '01/24/26', inState: true },
  { name: 'Cain Van Norden', pos: 'DL', school: 'Bishop McNamara (District Heights, MD)', htWt: '6-7 / 299', stars: 3, rating: '85.00', natl: 879, posRk: 88, stRk: 22, date: '05/15/26', inState: false },
  { name: 'Cahron Wheeler', pos: 'EDGE', school: "St. Paul's School (Baltimore, MD)", htWt: '6-5 / 245', stars: 4, rating: '91.89', natl: 128, posRk: 14, stRk: 3, date: '06/05/26', inState: false },
  { name: 'Zahmar Tookes', pos: 'DL', school: 'Brighton (Rochester, NY)', htWt: '6-3.5 / 260', stars: 4, rating: '89.68', natl: 318, posRk: 33, stRk: 2, date: '06/03/26', inState: false }
];

const targets2027 = [
  { name: "Tra'Von Hall", pos: 'WR', note: 'on3 reports: Oklahoma commit visited Gainesville May 30-31 and remains a top flip candidate.' },
  { name: 'Derrick Malone', pos: 'EDGE', note: 'on3 recruiting sources say Florida is trending, decision is close, and the in-home visit gave UF momentum.' },
  { name: 'Devon Hall', pos: 'S', note: 'on3 intel: Ocala native with a visit scheduled, strong UF ties, and Florida viewed as a leading option.' }
];

const portalIncoming = [
  { name: 'Eric Singleton Jr.', pos: 'WR', from: 'Auburn', htWt: '6-2 / 185', stars: 4, note: 'Auburn transfer is the clear WR1.' },
  { name: 'Harrison Moore', pos: 'C', from: 'Georgia Tech', htWt: '6-3 / 300', stars: 3, note: 'Georgia Tech transfer starts at center.' },
  { name: 'Eagan Boyer', pos: 'LT', from: 'Penn State', htWt: '6-5 / 305', stars: 3, note: 'Penn State transfer. Backup tackle.' },
  { name: 'TJ Shanahan Jr.', pos: 'RG', from: 'Penn State', htWt: '6-4 / 315', stars: 3, note: 'Battling Bryce Lovett for RG.' },
  { name: 'Evan Pryor', pos: 'RB', from: 'Cincinnati', htWt: '5-10 / 195', stars: 3, note: 'Cincinnati transfer adds RB depth.' },
  { name: 'Luke Harpring', pos: 'TE', from: 'Georgia Tech', htWt: '6-5 / 245', stars: 3, note: 'Georgia Tech TE.' },
  { name: 'Cam Dooley', pos: 'FS/S', from: 'Kentucky', htWt: '6-1 / 205', stars: 3, note: 'Kentucky transfer.' },
  { name: 'DJ Coleman', pos: 'S/STAR', from: 'Baylor', htWt: '6-2 / 210', stars: 3, note: 'Baylor transfer. Rotates at STAR behind Kanye Clark.' },
  { name: 'Patrick Durkin', pos: 'K', from: 'Tulane', htWt: '6-1 / 195', stars: 3, note: 'Tulane transfer won kicker job.' },
  { name: 'Lacota Dippre', pos: 'TE', from: 'Charlotte / James Madison', htWt: '6-4 / 240', stars: 3, note: 'Starting Y TE.' },
  { name: 'Bailey Stockton', pos: 'WR', from: 'Georgia Tech', htWt: '5-9 / 175', stars: 3, note: 'GT transfer. Slot WR.' },
  { name: 'DK Kalu', pos: 'DL/NOSE', from: 'Baylor', htWt: '6-3 / 270', stars: 3, note: 'Baylor transfer. Nose backup.' },
  { name: 'Alec Clark', pos: 'P', from: 'Marshall / Tulane', htWt: '6-1 / 184', stars: 3, note: 'Starting punter.' },
  { name: 'Emmanuel Oyebadejo', pos: 'DL/END', from: 'Jacksonville State', htWt: '6-7 / 315', stars: 3, note: 'England native. Massive frame.' },
  { name: 'London Montgomery', pos: 'RB', from: 'Penn State / East Carolina', htWt: '5-10 / 185', stars: 3, note: 'KR1 and RB depth.' },
  { name: 'Carter Milliron', pos: 'LS', from: 'Louisiana', htWt: '6-0 / 257', stars: 3, note: 'Starting long snapper.' },
  { name: 'Miller Fealy', pos: 'P', from: 'UT Martin', htWt: '6-2 / 210', stars: 3, note: 'Backup punter.' },
  { name: 'TJ Bullard', pos: 'LB', from: 'UCF', htWt: '6-1 / 200', stars: 3, note: 'UCF transfer. LB depth.' },
  { name: 'Jaylen Lloyd', pos: 'WR', from: 'Nebraska / Oklahoma State', htWt: '5-11 / 180', stars: 3, note: 'WR depth.' },
  { name: 'Mason Clinton', pos: 'DL', from: 'Louisiana / Mississippi State', htWt: '6-5 / 265', stars: 3, note: 'DT rotation.' },
  { name: 'Evan Chieca', pos: 'TE', from: 'New Haven', htWt: '6-5 / 250', stars: 3, note: 'Y TE backup.' },
  { name: 'Jordy Lowery', pos: 'CB', from: 'Western Carolina / East Carolina', htWt: '5-11 / 167', stars: 3, note: 'CB depth.' },
  { name: 'Ace Ciongoli', pos: 'WR', from: 'Indiana', htWt: '5-11 / 190', stars: 3, note: 'Indiana transfer WR.' }
];

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('Seeding recruiting data →', DATA_DIR);

  for (const r of class2026) {
    await upsertPlayer({
      slug: slugify(r.name),
      name: r.name,
      pos: r.pos,
      classYear: 2026,
      school: r.school,
      htWt: r.htWt,
      stars: r.stars,
      category: 'recruit',
      status: r.status === 'Enrolled' ? 'enrolled' : 'committed',
      skinny: `${r.pos} · ${r.stars}★ · ${r.school}`
    });
  }

  for (const r of class2027) {
    if (r.category === 'target') {
      await upsertPlayer({
        slug: slugify(r.name),
        name: r.name,
        pos: r.pos,
        classYear: 2027,
        school: r.school,
        stars: r.stars,
        category: 'target',
        status: 'target',
        skinny: r.skinny || r.school
      });
      continue;
    }
    await upsertPlayer({
      slug: slugify(r.name),
      name: r.name,
      pos: r.pos,
      classYear: 2027,
      school: r.school,
      htWt: r.htWt,
      stars: r.stars,
      rating: r.rating,
      natlRank: r.natl,
      posRank: r.posRk,
      stateRank: r.stRk,
      inState: r.inState,
      category: 'recruit',
      status: 'committed',
      commitDate: r.date,
      skinny: r.skinny || `${r.pos} · ${r.stars}★ · ${r.school}`,
      profileNote: r.name === 'Maxwell Hiller'
        ? 'The #3 player in the country at any position. Landing Hiller gives this class an elite anchor along the interior offensive line.'
        : ''
    });
  }

  for (const t of targets2027) {
    const slug = slugify(t.name);
    const existing = class2027.find((c) => slugify(c.name) === slug);
    if (existing && existing.category === 'target') continue;
    await upsertPlayer({
      slug,
      name: t.name,
      pos: t.pos,
      classYear: 2027,
      category: 'target',
      status: 'target',
      skinny: t.note,
      profileNote: t.note
    });
  }

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
      status: 'portal_in',
      fromSchool: p.from,
      skinny: p.note,
      profileNote: p.note,
      starsDisplay: '★'.repeat(p.stars)
    });
  }

  await upsertRanking({ classYear: 2026, nationalRank: 16, secRank: 8, classScore: 89.75, source: 'on3' });
  await upsertRanking({ classYear: 2027, nationalRank: 5, secRank: 3, classScore: 92.58, source: 'on3' });

  console.log('Done. Players + rankings seeded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
