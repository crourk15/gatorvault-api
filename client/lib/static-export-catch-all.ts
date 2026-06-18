/** Optional catch-all static export — one HTML shell serves all slug URLs client-side. */
export function catchAllStaticParams(): { slug: string[] }[] {
  return [{ slug: [] }];
}
