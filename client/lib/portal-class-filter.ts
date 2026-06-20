/** Minimum class year for portal-related GNL content (2027 cycle). */
export const PORTAL_MIN_CLASS_YEAR = 2027;

const PORTAL_PATTERN =
  /\bportal\b|\btransfer\b|\bentered\s+the\s+portal\b|\bportal\s+entry\b|\bin\s+the\s+portal\b/i;
const CLASS_OF_PATTERN = /\bclass\s+of\s+(20\d{2})\b/i;
const YEAR_PATTERN = /\b(20(?:2[4-9]|3[0-5]))\b/g;
const SHORTHAND_PATTERN = /(?:^|[\s(])[''](\d{2})\b/;

export type PortalClassMetadata = {
  classYear?: number;
  type?: string;
  source?: string;
};

export function isPortalRelatedContent(text: string, extra = ''): boolean {
  const blob = `${text} ${extra}`;
  return PORTAL_PATTERN.test(blob);
}

export function extractClassYearFromText(text: string): number | null {
  const classOf = text.match(CLASS_OF_PATTERN);
  if (classOf) return parseInt(classOf[1], 10);

  const years = [...text.matchAll(YEAR_PATTERN)].map((m) => parseInt(m[1], 10));
  if (years.length === 1) return years[0];
  if (years.length > 1) {
    const recruiting = years.filter((y) => y >= 2024 && y <= 2032);
    return recruiting[0] ?? years[0];
  }

  const shorthand = text.match(SHORTHAND_PATTERN);
  if (shorthand) {
    const yy = parseInt(shorthand[1], 10);
    return yy >= 24 && yy <= 32 ? 2000 + yy : null;
  }

  return null;
}

export function extractClassYear(text: string, metadata?: PortalClassMetadata): number | null {
  if (metadata?.classYear != null && Number.isFinite(metadata.classYear)) {
    return metadata.classYear;
  }
  return extractClassYearFromText(text);
}

/** True when portal-related content should be hidden (class year below 2027). */
export function isExcludedPortalClassItem(text: string, metadata?: PortalClassMetadata): boolean {
  const extra = `${metadata?.type ?? ''} ${metadata?.source ?? ''}`;
  const portal =
    metadata?.type?.toUpperCase() === 'PORTAL' || isPortalRelatedContent(text, extra);
  if (!portal) return false;

  const year = extractClassYear(text, metadata);
  if (year === null) return false;
  return year < PORTAL_MIN_CLASS_YEAR;
}

/** True when a portal note qualifies for the pulse quadrant (class >= 2027). */
export function isEligiblePortalPulseItem(text: string, metadata?: PortalClassMetadata): boolean {
  const extra = `${metadata?.type ?? ''} ${metadata?.source ?? ''}`;
  if (!isPortalRelatedContent(text, extra) && metadata?.type?.toUpperCase() !== 'PORTAL') {
    return false;
  }

  const year = extractClassYear(text, metadata);
  if (year === null) return true;
  return year >= PORTAL_MIN_CLASS_YEAR;
}

export function filterExcludedPortalClassItems<T>(
  items: T[],
  getText: (item: T) => string,
  getMetadata?: (item: T) => PortalClassMetadata | undefined
): T[] {
  return items.filter((item) => !isExcludedPortalClassItem(getText(item), getMetadata?.(item)));
}
