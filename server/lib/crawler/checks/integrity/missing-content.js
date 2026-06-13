/**
 * integrity:missing-content — delegates to react-routes (vault-route-map canonical).
 */
const { runReactRouteValidationChecks } = require('./react-routes');

module.exports = {
  runMissingContentChecks: runReactRouteValidationChecks,
  runReactRouteValidationChecks
};
