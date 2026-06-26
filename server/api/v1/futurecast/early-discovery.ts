/**
 * GET /api/futurecast/early-discovery
 * @see server/docs/futurecast-platform-spec.md §3.4, §4.1 Early Discovery tab
 */
export { handleGetEarlyDiscovery as handleEarlyDiscovery, listEarlyDiscoveryPlayers as getEarlyDiscovery } from '../../futurecast/early-discovery';
