const v = require('../lib/identity-record-validator');
const store = require('../lib/recruiting-store');

(async () => {
  for (const slug of ['will-griffin', 'eric-singleton-jr', 't-j-shanahan', 'tj-shanahan-jr', 'jalen-brewster']) {
    const p = await store.getPlayerBySlug(slug);
    const healed = v.healPlayerRecord(p, p);
    const r = v.validatePlayerIdentityRecord(healed);
    console.log(slug, r.valid, r.errors);
  }
})();
