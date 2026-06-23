import React from 'react';
import { homeWowBootScript } from '@/lib/home-wow-boot';

/** Server-rendered boot — paints home metrics before React bundle loads. */
export function HomeWowBootScript(): React.ReactElement {
  return (
    <script
      data-home-wow-boot=""
      dangerouslySetInnerHTML={{ __html: homeWowBootScript() }}
    />
  );
}
