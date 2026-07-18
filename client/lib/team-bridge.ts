/**
 * Bridge Charles' original gv-team-mobile.js module into the React vault shell.
 */
import {
  DEPTH_BY_PHASE,
  type DepthChartRow,
  type DepthPhase,
} from '@/lib/depth-chart-data';
import { navigateVaultHref } from '@/lib/navigate-vault-href';
import { playerProfilePath } from '@/lib/player-routes';
import { saveVaultPageState, type VaultPageState } from '@/lib/vault-navigation';
import type { RosterPlayer } from '@/lib/roster-api';

declare global {
  interface Window {
    playerDisplayRating?: (p: RosterPlayer) => number | null;
    ratingTier?: (r: number) => string;
    gvPlayerInitials?: (name: string) => string;
    gvRenderTeam?: () => void;
    renderDC?: () => void;
    gvApplyTeamDeepLink?: () => void;
    _gvTeamBridgeReady?: boolean;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTeamScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window._gvTeamBridgeReady) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gv-team-mobile]');
    if (existing) {
      window._gvTeamBridgeReady = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '/js/gv-team-mobile.js';
    script.defer = true;
    script.dataset.gvTeamMobile = '1';
    script.onload = () => {
      window._gvTeamBridgeReady = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load gv-team-mobile.js'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

function installGlobals(): void {
  window.playerDisplayRating = (p) => {
    const raw = p.vaultGrade ?? (p as RosterPlayer & { rating?: number }).rating;
    return raw != null ? Number(raw) : null;
  };
  window.ratingTier = (r) => {
    if (r >= 90) return 'rating-elite';
    if (r >= 85) return 'rating-strong';
    return 'rating-solid';
  };
  window.gvPlayerInitials = (name) => {
    const parts = String(name || '')
      .replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, '')
      .trim()
      .split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };
}

function renderDCCards(data: DepthChartRow[], containerId: string): void {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  data.forEach((r) => {
    const stCls =
      r.status === 'locked'
        ? 'gv-dc-status--locked'
        : r.status === 'battle'
          ? 'gv-dc-status--battle'
          : 'gv-dc-status--watch';
    const stLabel = r.status === 'locked' ? 'Locked' : r.status === 'battle' ? 'Battle' : 'Watch';
    let html = '<div class="dc-card gv-dc-premium rounded-xl">';
    html += `<div class="gv-dc-premium-hdr"><span class="gv-dc-pos">${r.pos}</span><span class="gv-dc-status ${stCls}">${stLabel}</span></div>`;
    html += `<div class="gv-dc-depth-row gv-dc-depth-row--1"><span class="gv-dc-depth-rank">1</span><span class="gv-dc-depth-name">${r.s}</span><span class="gv-dc-depth-meta">${r.si}</span></div>`;
    if (r.b && r.b !== '—') {
      html += `<div class="gv-dc-depth-row"><span class="gv-dc-depth-rank">2</span><span class="gv-dc-depth-name">${r.b}</span><span class="gv-dc-depth-meta">${r.bi}</span></div>`;
    }
    if (r.third) {
      html += `<div class="gv-dc-depth-row"><span class="gv-dc-depth-rank">3</span><span class="gv-dc-depth-name">${r.third}</span><span class="gv-dc-depth-meta"></span></div>`;
    }
    html += `<div class="dc-detail">${r.analysis}</div></div>`;
    el.innerHTML += html;
  });
}

function installRenderDC(): void {
  window.renderDC = () => {
    (['off', 'def', 'st'] as DepthPhase[]).forEach((ph) => {
      renderDCCards(DEPTH_BY_PHASE[ph], `gv-team-dc-${ph}`);
    });
  };
}

function wireDepthPhaseTabs(): void {
  document.querySelectorAll('#vpane-team .dctbtn[data-dc-root="team"]').forEach((btn) => {
    if ((btn as HTMLElement).dataset.wired) return;
    (btn as HTMLElement).dataset.wired = '1';
    btn.addEventListener('click', () => {
      const ph = btn.getAttribute('data-phase');
      const pane = document.getElementById('vpane-team');
      if (!pane || !ph) return;
      pane.querySelectorAll('.dctbtn[data-dc-root="team"]').forEach((x) => {
        x.classList.remove('active');
      });
      btn.classList.add('active');
      pane.querySelectorAll('.dc-phase').forEach((p) => {
        (p as HTMLElement).style.display = 'none';
        p.classList.remove('active');
      });
      const target = document.getElementById(`gv-team-dc-${ph}`);
      if (target) {
        target.style.display = 'grid';
        target.classList.add('active');
      }
    });
  });
}

export async function initTeamModule(): Promise<void> {
  installGlobals();
  installRenderDC();
  await loadTeamScript();
  if (typeof window.renderDC === 'function') window.renderDC();
  if (typeof window.gvRenderTeam === 'function') window.gvRenderTeam();
  wireDepthPhaseTabs();
  if (typeof window.gvApplyTeamDeepLink === 'function') window.gvApplyTeamDeepLink();
}

export function wireTeamRosterNavigation(getState: () => VaultPageState): void {
  const root = document.getElementById('vpane-team');
  if (!root || root.dataset.rosterNavWired) return;
  root.dataset.rosterNavWired = '1';

  root.addEventListener(
    'click',
    (e) => {
      const card = (e.target as HTMLElement).closest('.gv-mteam-roster-card[data-slug]');
      if (!card) return;
      const slug = card.getAttribute('data-slug');
      if (!slug) return;
      e.preventDefault();
      e.stopPropagation();
      saveVaultPageState('team', getState());
      navigateVaultHref(playerProfilePath(slug, 'ROSTER', true, null, 'roster'));
    },
    true
  );
}
