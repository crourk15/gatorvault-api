'use client';

import React from 'react';
import type { LivePanelProps } from '@/lib/gatornation-live-types';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { LivePanel } from './LivePanel';

type PanelBundle = {
  visitsNow: LivePanelProps['items'];
  portalBuzz: LivePanelProps['items'];
  beatWriterHighlights: LivePanelProps['items'];
  staffNotes: LivePanelProps['items'];
};

type Props = {
  panels: PanelBundle;
};

export function LivePanelsGrid({ panels }: Props): React.ReactElement {
  return (
    <div className="gv-gnl-panels" data-testid="gnl-live-panels">
      <LivePanel
        title={GNL_COPY.panels.visits.title}
        description={GNL_COPY.panels.visits.description}
        items={panels.visitsNow}
      />
      <LivePanel
        title={GNL_COPY.panels.portal.title}
        description={GNL_COPY.panels.portal.description}
        items={panels.portalBuzz}
      />
      <LivePanel
        title={GNL_COPY.panels.beat.title}
        description={GNL_COPY.panels.beat.description}
        items={panels.beatWriterHighlights}
      />
      <LivePanel
        title={GNL_COPY.panels.staff.title}
        description={GNL_COPY.panels.staff.description}
        items={panels.staffNotes}
        insider
      />
    </div>
  );
}
