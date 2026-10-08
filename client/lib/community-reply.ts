/** Flat thread replies still need a name so the locker reads as conversation. */

export function communityReplyMention(displayName: string): string {
  const name = String(displayName || '').trim();
  return name ? `@${name} ` : '';
}

function stripLeadingMention(body: string, displayName: string): string | null {
  const name = String(displayName || '').trim();
  if (!name) return null;
  const tag = `@${name}`;
  const trimmed = String(body || '').replace(/^\s+/, '');
  if (trimmed === tag) return '';
  if (trimmed.startsWith(`${tag} `) || trimmed.startsWith(`${tag}\n`)) {
    return trimmed.slice(tag.length).replace(/^\s+/, '');
  }
  return null;
}

export function withCommunityReplyMention(
  body: string,
  displayName: string,
  previousName?: string | null,
): string {
  const mention = communityReplyMention(displayName);
  if (!mention) return String(body || '');
  const name = displayName.trim();
  const text = String(body || '');
  if (!text.trim() || text.trim() === `@${name}`) return mention;

  const fromCurrent = stripLeadingMention(text, name);
  if (fromCurrent !== null) return mention + fromCurrent;

  if (previousName) {
    const fromPrev = stripLeadingMention(text, previousName);
    if (fromPrev !== null) return mention + fromPrev;
  }

  return mention + text.replace(/^\s+/, '');
}
