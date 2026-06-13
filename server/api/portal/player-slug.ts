/**
 * GET /api/portal/players/:slug — portal profile (Postgres + recruiting-store fallback).
 */
export { handleGetPlayerBySlug as handleGetPortalPlayerBySlug } from '../players/slug/[slug]';
