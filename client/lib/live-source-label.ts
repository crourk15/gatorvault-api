/**
 * Fan-facing live source labels — never show internal ids like `auto:on3-team-news`.
 */

export function formatLiveSourceLabel(raw?: string | null): string {
  const s = String(raw || "").trim();
  if (!s) return "GatorVault";

  const stripped = s.replace(/^auto:/i, "").trim();
  const key = stripped.toLowerCase().replace(/_/g, "-");

  const KNOWN: Record<string, string> = {
    "on3-team-news": "On3",
    "on3-news": "On3",
    on3: "On3",
    "beat-writer": "Beat",
    "beat-intel": "Beat",
    "beat-momentum": "Beat",
    beat: "Beat",
    "detectives-beat": "Gators Detectives",
    detectives: "Gators Detectives",
    "rivals-pm": "Rivals",
    rivals: "Rivals",
    "heat-pulse": "GatorVault",
    portal: "Portal",
    recruiting: "Recruiting",
    gatorvault: "GatorVault",
    insider: "Insider",
  };

  if (KNOWN[key]) return KNOWN[key];
  if (/^on3/.test(key)) return "On3";
  if (/beat/.test(key)) return "Beat";
  if (/detectives/.test(key)) return "Gators Detectives";
  if (/rivals/.test(key)) return "Rivals";
  if (/portal/.test(key)) return "Portal";

  const pretty = stripped
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return pretty || "GatorVault";
}
