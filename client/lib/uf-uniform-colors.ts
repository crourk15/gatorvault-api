/**
 * Map official UF uniform part names (helmet / jersey / pants) to display colors.
 * Source tokens come from GatorsFB 2026 lineup on /api/schedule.
 */

export type UfUniformPart = 'helmet' | 'jersey' | 'pants';

export type UfUniformSwatch = {
  token: string;
  label: string;
  background: string;
  color: string;
  border: string;
};

const PART_LABEL: Record<UfUniformPart, string> = {
  helmet: 'Helmet',
  jersey: 'Jersey',
  pants: 'Pants',
};

function normalizeToken(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** Resolve a single combo token (Orange, Blue, White, Retro, …). */
export function ufUniformSwatch(raw: string | null | undefined): UfUniformSwatch | null {
  const token = String(raw || '').trim();
  if (!token) return null;
  const key = normalizeToken(token);

  if (key === 'orange') {
    return {
      token,
      label: 'Orange',
      background: '#fa4616',
      color: '#ffffff',
      border: 'rgba(255, 255, 255, 0.35)',
    };
  }
  if (key === 'blue') {
    return {
      token,
      label: 'Blue',
      background: '#0021a5',
      color: '#ffffff',
      border: 'rgba(255, 255, 255, 0.35)',
    };
  }
  if (key === 'white') {
    return {
      token,
      label: 'White',
      background: '#f4f6fb',
      color: '#0021a5',
      border: 'rgba(0, 33, 165, 0.35)',
    };
  }
  if (key === 'retro') {
    // Throwback cream helmet — reads distinct from plain white.
    return {
      token,
      label: 'Retro',
      background: 'linear-gradient(135deg, #e8dcc8 0%, #f7f1e6 55%, #d4c4a8 100%)',
      color: '#0021a5',
      border: 'rgba(250, 70, 22, 0.55)',
    };
  }

  // Unknown token — still show the name so fans see the combo.
  return {
    token,
    label: token,
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    border: 'rgba(255, 255, 255, 0.35)',
  };
}

export function ufUniformPartLabel(part: UfUniformPart): string {
  return PART_LABEL[part];
}

export type UfUniformParts = {
  helmet?: string | null;
  jersey?: string | null;
  pants?: string | null;
  label?: string | null;
  note?: string | null;
};

export type UfUniformChip = {
  part: UfUniformPart;
  partLabel: string;
  swatch: UfUniformSwatch;
};

/** Build Helmet / Jersey / Pants chips when parts exist. */
export function buildUfUniformChips(uniform: UfUniformParts | null | undefined): UfUniformChip[] {
  if (!uniform) return [];
  const chips: UfUniformChip[] = [];
  for (const part of ['helmet', 'jersey', 'pants'] as UfUniformPart[]) {
    const swatch = ufUniformSwatch(uniform[part]);
    if (!swatch) continue;
    chips.push({ part, partLabel: PART_LABEL[part], swatch });
  }
  return chips;
}
