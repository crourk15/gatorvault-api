/**
 * FutureCast Player Profile 2.0 — production page (slug route).
 * Route: /futurecast/player/:slug
 */
import React from 'react';
import { PlayerProfilePage } from '../../../components/futurecast/player/PlayerProfilePage';

export interface PlayerRouteProps {
  slug: string;
}

export default function PlayerRoute({ slug }: PlayerRouteProps): React.ReactElement {
  return <PlayerProfilePage slug={slug} />;
}
