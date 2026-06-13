/**
 * Rebuild client/lib/vault-shell.css as UTF-8 (fixes UTF-16 corruption).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'client', 'lib', 'vault-shell.css');
const base = execSync('git show 55ac96d:client/lib/vault-shell.css', {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

const phase9Append = `
/* ── Phase 9: Elite Recruit Cards (On3/Rivals style) ── */

.gv-rh--elite .gv-page-hero {
  margin-bottom: 1.25rem;
}

.gv-elite-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.gv-elite-grid--heat {
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.gv-elite-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 1rem;
  border: 1px solid rgba(0, 48, 135, 0.45);
  background: linear-gradient(165deg, rgba(12, 24, 48, 0.98) 0%, rgba(6, 14, 28, 0.98) 100%);
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
}

.gv-elite-card:hover {
  border-color: rgba(250, 70, 22, 0.55);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(250, 70, 22, 0.12);
}

.gv-elite-card--headliner {
  border-color: rgba(250, 70, 22, 0.65);
}

.gv-elite-card--committed {
  border-color: rgba(34, 197, 94, 0.35);
}

.gv-elite-card__rank-badge {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  z-index: 2;
  font-family: 'Oswald', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fa4616;
  background: rgba(0, 0, 0, 0.65);
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}

.gv-elite-card__photo-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 1rem 0.75rem;
  background: linear-gradient(180deg, rgba(0, 48, 135, 0.25) 0%, transparent 100%);
}

.gv-elite-card__photo {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 3px solid rgba(250, 70, 22, 0.45);
  background: linear-gradient(135deg, #003087, #001a40);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gv-elite-card__initials {
  font-family: 'Oswald', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
}

.gv-elite-card__stars {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #fbbf24;
}

.gv-elite-card__body {
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.gv-elite-card__name {
  font-family: 'Oswald', sans-serif;
  font-size: 1.0625rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  text-align: center;
}

.gv-elite-card__pos-class,
.gv-elite-card__htwt,
.gv-elite-card__school {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
  text-align: center;
}

.gv-rh-intel-unified { margin-top: 0.5rem; }
.gv-hub-tabs--sub { margin-bottom: 1rem; }

.gv-rh-portal-closed {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 1rem;
  border: 1px dashed rgba(0, 48, 135, 0.45);
  background: rgba(6, 15, 31, 0.6);
}

.gv-rh-portal-closed__icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.gv-live-feed__social-lanes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.gv-live-feed__social-lane {
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(0, 48, 135, 0.3);
  background: rgba(6, 15, 31, 0.75);
}

.gv-live-feed__social-lane-title {
  font-family: 'Oswald', sans-serif;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #fa4616;
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.gv-live-feed__row--social { padding: 0.5rem 0; }
.gv-live-feed__row--headline { /* QA marker */ }
.gv-live-feed__row--empty {
  font-size: 0.75rem;
  color: #64748b;
  list-style: none;
}

@media (max-width: 640px) {
  .gv-elite-grid { grid-template-columns: 1fr; }
}
`;

fs.writeFileSync(OUT, base.trimEnd() + phase9Append, 'utf8');
console.log('Fixed vault-shell.css UTF-8, bytes:', fs.statSync(OUT).size);
