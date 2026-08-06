/**
 * FutureCast API — Express mount (loads TypeScript handlers via tsx).
 */
require('tsx/cjs');

const { mountFutureCastPlayersRoutes } = require('../api/players/mount.ts');
const { mountFutureCastBigBoardRoutes } = require('../api/big-board/mount.ts');
const { mountFutureCastPortalRoutes } = require('../api/portal/mount.ts');
const { mountFutureCastUfFitRoutes } = require('../api/uf-fit/mount.ts');
const { mountFutureCastPredictionsRoutes } = require('../api/predictions/mount.ts');
const { mountFutureCastFeatureRoutes } = require('../api/futurecast/mount.ts');
const { mountFutureCastAlertsRoutes } = require('../api/alerts/mount.ts');
const { mountRecruitsRoutes } = require('../api/recruits/mount.ts');
const { mountStaffRoutes } = require('../api/staff/mount.ts');
const { mountPlayerProfileRoutes } = require('../api/player/mount.ts');
const { mountSharePlayerRoutes } = require('./share-player-card');

function mountFutureCastApiRoutes(app) {
  mountFutureCastPlayersRoutes(app);
  mountFutureCastBigBoardRoutes(app);
  mountFutureCastPortalRoutes(app);
  mountFutureCastUfFitRoutes(app);
  mountFutureCastPredictionsRoutes(app);
  mountFutureCastFeatureRoutes(app);
  mountFutureCastAlertsRoutes(app);
  mountRecruitsRoutes(app);
  mountStaffRoutes(app);
  mountPlayerProfileRoutes(app);
  mountSharePlayerRoutes(app);
  console.log('[futurecast] API mounted: /api/players, /api/player/full-profile, /api/player/resolve, /api/share/player, /api/big-board, /api/portal, /api/uf-fit, /api/predictions, /api/predictors, /api/futurecast/*, /api/recruits, /api/alerts, /api/staff/dashboard');
}

module.exports = {
  mountFutureCastPlayersRoutes: mountFutureCastApiRoutes,
  mountFutureCastApiRoutes,
};
