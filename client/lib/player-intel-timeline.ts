/**
 * Merge staff notes + beat/staff signals for a player slug (D4 timeline).
 */
import type { StaffNotesResponse } from '@/lib/futurecast-board-types';

export type PlayerIntelTimelineEntry = {
  kind: 'staff' | 'beat';
  label: string;
  preview: string;
  timestamp?: string | null;
};

function notePreview(note: {
  notePreview?: string | null;
  note?: string | null;
  staffNotes?: string | null;
  insiderNotes?: string | null;
  projection?: string | null;
}): string {
  return (
    note.notePreview?.trim() ||
    note.staffNotes?.trim() ||
    note.insiderNotes?.trim() ||
    note.projection?.trim() ||
    note.note?.trim() ||
    ''
  );
}

export function buildStaffNoteIndex(staffNotes: StaffNotesResponse): Map<string, PlayerIntelTimelineEntry[]> {
  const map = new Map<string, PlayerIntelTimelineEntry[]>();
  for (const note of staffNotes.notes || []) {
    const slug = String(note.playerSlug || '').toLowerCase();
    if (!slug) continue;
    const preview = notePreview(note);
    if (!preview) continue;
    const row: PlayerIntelTimelineEntry = {
      kind: 'staff',
      label: 'Staff note',
      preview: preview.length > 140 ? `${preview.slice(0, 137)}…` : preview,
      timestamp: note.updatedAt ?? note.createdAt ?? staffNotes.updatedAt,
    };
    const list = map.get(slug) || [];
    list.push(row);
    map.set(slug, list);
  }
  return map;
}

export function latestPlayerIntelTimeline(
  slug: string,
  staffNotes: StaffNotesResponse
): PlayerIntelTimelineEntry | null {
  const index = buildStaffNoteIndex(staffNotes);
  const rows = index.get(String(slug || '').toLowerCase()) || [];
  return rows[0] ?? null;
}