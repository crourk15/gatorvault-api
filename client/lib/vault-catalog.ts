/** Static catalog data ported from monolith index.html. */

export type TicketGame = {
  game: string;
  date: string;
  venue: string;
  type: 'HOME' | 'AWAY' | 'NEUTRAL' | 'BYE';
  note?: string;
};

export type ApparelShop = {
  icon: string;
  badge: string;
  name: string;
  desc: string;
  url: string;
};

/** Official 2026 Florida football slate (aligned to floridagators.com / SEC windows). */
export const TICKET_GAMES: TicketGame[] = [
  {
    game: '🐊 UF vs FAU',
    date: 'September 5, 2026 · 7:45 PM ET',
    venue: 'Ben Hill Griffin Stadium, Gainesville FL',
    type: 'HOME',
    note: 'SEC Network',
  },
  {
    game: '🐊 UF vs Campbell',
    date: 'September 12, 2026 · 5:30 PM ET',
    venue: 'Ben Hill Griffin Stadium, Gainesville FL',
    type: 'HOME',
    note: 'SECN+',
  },
  {
    game: '🐊 UF @ Auburn',
    date: 'September 19, 2026 · 7:00 PM ET',
    venue: 'Jordan-Hare Stadium, Auburn AL',
    type: 'AWAY',
    note: 'ESPN',
  },
  {
    game: '🐊 UF vs Ole Miss',
    date: 'September 26, 2026 · 3:30–8:00 PM ET',
    venue: 'Ben Hill Griffin Stadium, Gainesville FL',
    type: 'HOME',
    note: 'TV TBD · window 3:30–8:00 PM ET',
  },
  {
    game: '🐊 UF @ Missouri',
    date: 'October 3, 2026 · 3:30–8:00 PM ET',
    venue: 'Faurot Field, Columbia MO',
    type: 'AWAY',
    note: 'TV TBD · window 3:30–8:00 PM ET',
  },
  {
    game: '🐊 UF vs South Carolina (HC)',
    date: 'October 10, 2026 · 12:00–1:00 PM ET',
    venue: 'Ben Hill Griffin Stadium, Gainesville FL',
    type: 'HOME',
    note: 'Homecoming · TV TBD · early window',
  },
  {
    game: '🐊 UF @ Texas',
    date: 'October 17, 2026 · 12:00–1:00 PM ET',
    venue: 'DKR-Texas Memorial Stadium, Austin TX',
    type: 'AWAY',
    note: 'TV TBD · early window',
  },
  {
    game: '🐊 OFF — Bye week',
    date: 'October 24, 2026 · OFF',
    venue: 'Invesco QQQ Atlanta Gridiron Classic week',
    type: 'BYE',
    note: 'Open date on the SEC calendar',
  },
  {
    game: '🐊 UF vs Georgia',
    date: 'October 31, 2026 · 3:30 PM ET',
    venue: 'Mercedes-Benz Stadium, Atlanta GA',
    type: 'NEUTRAL',
    note: "World's Largest Outdoor Cocktail Party (Atlanta 2026) · ABC",
  },
  {
    game: '🐊 UF vs Oklahoma',
    date: 'November 7, 2026 · 3:30–8:00 PM ET',
    venue: 'Ben Hill Griffin Stadium, Gainesville FL',
    type: 'HOME',
    note: 'TV TBD · window 3:30–8:00 PM ET',
  },
  {
    game: '🐊 UF @ Kentucky',
    date: 'November 14, 2026 · 6:00–8:00 PM ET',
    venue: 'Kroger Field, Lexington KY',
    type: 'AWAY',
    note: 'TV TBD · night window',
  },
  {
    game: '🐊 UF vs Vanderbilt',
    date: 'November 21, 2026 · 12:00–1:00 PM ET',
    venue: 'Ben Hill Griffin Stadium, Gainesville FL',
    type: 'HOME',
    note: 'TV TBD · early window',
  },
  {
    game: '🐊 UF @ FSU',
    date: 'November 27, 2026 · 3:30 PM ET',
    venue: 'Doak Campbell Stadium, Tallahassee FL',
    type: 'AWAY',
    note: 'Friday · ABC · Rivalry finale',
  },
];

export const APPAREL_SHOPS: ApparelShop[] = [
  {
    icon: '🏟️',
    badge: 'Official',
    name: 'Gator Sportshop',
    desc: 'The official Florida Gators online store — jerseys, hats, custom tees, and limited game-day drops. Operated by Fanatics.',
    url: 'https://shop.floridagators.com/florida-gators/t-12944192+z-9975266-1087192852',
  },
  {
    icon: '📚',
    badge: 'Campus',
    name: 'UF Bookstore',
    desc: 'Official university bookstore with Nike gear, championship apparel, and campus-exclusive designs. Purchases support UF programs.',
    url: 'https://www.bkstr.com/floridastore/shop/clothing-accessories',
  },
  {
    icon: '✔️',
    badge: 'Nike',
    name: 'Nike College — Florida',
    desc: "Official Nike Gators uniforms, Dri-FIT performance gear, and sideline pieces direct from Nike's college collection.",
    url: 'https://www.nike.com/college/florida',
  },
  {
    icon: '🛍️',
    badge: 'Top Seller',
    name: 'Fanatics',
    desc: 'Largest licensed Gators selection online — jerseys, collectibles, tailgate gear, and gift bundles with fast shipping.',
    url: 'https://www.fanatics.com/college/florida-gators',
  },
  {
    icon: '🧢',
    badge: 'Tailgate',
    name: 'Rally House',
    desc: 'Premium fan apparel, headwear, and tailgate essentials. Great for road games and out-of-town Gator fans.',
    url: 'https://www.rallyhouse.com/college/florida-gators',
  },
  {
    icon: '🧡',
    badge: 'Quick Ship',
    name: 'Amazon — Gators Gear',
    desc: 'Fast delivery on licensed and fan-made Gators apparel. Best for last-minute gifts or quick replacements.',
    url: 'https://www.amazon.com/s?k=florida+gators+apparel',
  },
];

export const APPAREL_PILLS = ['Official Licensed', 'Fast Shipping', 'Game Day Ready', 'On Campus Pickup'];
