/**
 * Player Profiles 2.0 page.
 * @see server/docs/futurecast-platform-spec.md §4.2
 */
import React from 'react';
import { ProfileTabs } from '../../../components/futurecast/ProfileTabs';

export interface PlayerPageProps {
  playerId: string;
}

export default function PlayerProfilePage({ playerId }: PlayerPageProps): React.ReactElement {
  // TODO(Phase 4): GET /api/players/:id
  void playerId;
  return (
    <div data-testid="player-profile-page">
      <header>{/* TODO: name, photo, UF Fit Score — spec §4.2 Header */}</header>
      <ProfileTabs />
    </div>
  );
}
