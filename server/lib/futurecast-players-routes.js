/**
 * FutureCast API — Express mount (loads TypeScript handlers via tsx).
 */
require('tsx/cjs');

const { mountFutureCastPlayersRoutes } = require('../api/players/mount.ts');
const { mountFutureCastBigBoardRoutes } = require('../api/big-board/mount.ts');
const { mountFutureCastPortalRoutes } = require('../api/portal/mount.ts');
const { mountFutureCastUfFitRoutes } = require('../api/uf-fit/mount.ts');
const { mountFutureCastPredictionsRoutes } = require('../api/predictions/mount.ts');

function mountFutureCastApiRoutes(app) {
  mountFutureCastPlayersRoutes(app);
  mountFutureCastBigBoardRoutes(app);
  mountFutureCastPortalRoutes(app);
  mountFutureCastUfFitRoutes(app);
  mountFutureCastPredictionsRoutes(app);
  console.log('[futurecast] API mounted: /api/players, /api/big-board, /api/portal, /api/uf-fit, /api/predictions, /api/predictors');
}

module.exports = {
  mountFutureCastPlayersRoutes: mountFutureCastApiRoutes,
  mountFutureCastApiRoutes,
};
