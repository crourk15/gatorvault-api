/**
 * Self-Runner — apply approved patches to codebase (only after explicit approval).
 */
const fs = require('fs');
const path = require('path');
const patches = require('./self-runner-patches');
const { dedupeFeedItems } = require('../live-feed-dedup');

const DEFAULT_TOKENS = {
  '--gv-team-card-bg': '#121c2e',
  '--gv-team-radius': '14px',
  '--gv-team-space-4': '16px',
  '--gv-team-title': 'clamp(1.75rem, 4vw, 2.5rem)',
  '--gv-team-body': '0.875rem'
};

function readFileRel(rel) {
  const p = patches.absPath(rel);
  return fs.readFileSync(p, 'utf8');
}

function writeFileRel(rel, content) {
  const p = patches.absPath(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

function extractRegion(html, regionId) {
  const marker = `id="${regionId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return { html, start: -1, end: -1, region: '' };
  const slice = html.slice(start);
  const nextVpane = slice.search(/<div[^>]+id="vpane-/i);
  const end = nextVpane > 50 ? start + nextVpane : html.length;
  return { html, start, end, region: html.slice(start, end) };
}

function addClassToOpeningTag(tagHtml, className) {
  if (tagHtml.includes(className)) return tagHtml;
  const classMatch = tagHtml.match(/class="([^"]*)"/);
  if (classMatch) {
    return tagHtml.replace(classMatch[0], `class="${classMatch[1]} ${className}"`);
  }
  return tagHtml.replace(/<div/, `<div class="${className}"`);
}

function applyRegionClassEdit(html, regionId, className, mode) {
  const { start, end, region } = extractRegion(html, regionId);
  if (start < 0) return html;
  let updated = region;
  if (mode === 'add') {
    const openEnd = updated.indexOf('>');
    if (openEnd > 0) {
      const openTag = updated.slice(0, openEnd + 1);
      const rest = updated.slice(openEnd + 1);
      updated = addClassToOpeningTag(openTag, className) + rest;
    }
  } else if (mode === 'remove') {
    updated = updated
      .replace(new RegExp(`\\b${className}\\b`, 'g'), '')
      .replace(/class="\s+/g, 'class="')
      .replace(/\s+"/g, '"');
  }
  return html.slice(0, start) + updated + html.slice(end);
}

function applyClassSwapInRegion(html, regionId, from, to) {
  const { start, end, region } = extractRegion(html, regionId);
  if (start < 0) return html;
  const updated = region.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  return html.slice(0, start) + updated + html.slice(end);
}

function applyInsertBefore(html, anchor, text) {
  if (html.includes(text.trim())) return html;
  const idx = html.indexOf(anchor);
  if (idx < 0) return html;
  return html.slice(0, idx) + text + html.slice(idx);
}

function applyInsertIfMissing(html, edit) {
  if (html.includes(edit.marker)) return html;
  return applyInsertBefore(html, edit.anchor, edit.text);
}

function applyEnsureTeamShell(html) {
  ['vpane-team', 'vpane-mteam'].forEach((regionId) => {
    html = applyRegionClassEdit(html, regionId, 'gv-team-page', 'add');
    if (regionId === 'vpane-team') {
      html = applyRegionClassEdit(html, regionId, 'gv-team-overview-layout', 'add');
    }
  });
  return html;
}

function applyFeedDedup(relPath) {
  const p = patches.absPath(relPath);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const items = raw.items || raw.feed || raw;
  const list = Array.isArray(items) ? items : [];
  const deduped = dedupeFeedItems(list);
  const out = Array.isArray(raw) ? deduped : { ...raw, items: deduped };
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  return { before: list.length, after: deduped.length };
}

function applyFilmSourceReplacements(dirRel, replacements) {
  const dir = patches.absPath(dirRel);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let count = 0;
  const urlMap = new Map((replacements || []).map((r) => [r.url, r.fallback]));

  files.forEach((file) => {
    const fp = path.join(dir, file);
    let text = fs.readFileSync(fp, 'utf8');
    let changed = false;
    urlMap.forEach((fallback, broken) => {
      if (broken && broken !== '(broken sources in catalog)' && text.includes(broken)) {
        text = text.split(broken).join(fallback);
        changed = true;
        count += 1;
      }
    });
    if (changed) fs.writeFileSync(fp, text);
  });

  if (count === 0 && replacements.length) {
    replacements.forEach(({ url, fallback }) => {
      if (!url || url === '(broken sources in catalog)') return;
      files.forEach((file) => {
        const fp = path.join(dir, file);
        let text = fs.readFileSync(fp, 'utf8');
        if (text.includes(url)) {
          fs.writeFileSync(fp, text.split(url).join(fallback));
          count += 1;
        }
      });
    });
  }

  return { replacements: count };
}

function applyCssTokens(relPath, tokens) {
  let css = readFileRel(relPath);
  const missing = (tokens || []).filter((t) => !css.includes(t));
  if (!missing.length) return { added: 0 };
  const block = missing
    .map((t) => `  ${t}: ${DEFAULT_TOKENS[t] || '#121c2e'};`)
    .join('\n');
  if (css.includes(':root')) {
    css = css.replace(':root {', `:root {\n${block}\n`);
  } else {
    css = `:root {\n${block}\n}\n` + css;
  }
  writeFileRel(relPath, css);
  return { added: missing.length };
}

function applyEdit(edit, state) {
  const file = edit.file;
  if (!state.files[file]) {
    try {
      state.files[file] = readFileRel(file);
    } catch {
      state.files[file] = '';
    }
  }

  let html = state.files[file];
  const type = edit.type;

  if (type === 'remove-class-from-region') {
    state.files[file] = applyRegionClassEdit(html, edit.regionId, edit.className, 'remove');
  } else if (type === 'add-class-to-region') {
    state.files[file] = applyRegionClassEdit(html, edit.regionId, edit.className, 'add');
  } else if (type === 'class-swap-in-region') {
    state.files[file] = applyClassSwapInRegion(html, edit.regionId, edit.from, edit.to);
  } else if (type === 'insert-before') {
    state.files[file] = applyInsertBefore(html, edit.anchor, edit.text);
  } else if (type === 'insert-if-missing') {
    state.files[file] = applyInsertIfMissing(html, edit);
  } else if (type === 'ensure-team-shell') {
    state.files[file] = applyEnsureTeamShell(html);
  } else if (type === 'dedupe-feed') {
    state.meta.feedDedup = applyFeedDedup(file);
  } else if (type === 'replace-broken-source-urls') {
    state.meta.filmSources = applyFilmSourceReplacements(edit.file, edit.replacements);
  } else if (type === 'ensure-css-tokens') {
    state.meta.cssTokens = applyCssTokens(file, edit.tokens);
  } else if (type === 'append-if-missing') {
    if (!html.includes(edit.marker)) {
      state.files[file] = html + (edit.text || '');
    }
  } else if (type === 'verify-hooks') {
    state.meta.hooks = { checkId: edit.checkId, note: 'verify-only' };
  }

  return state;
}

function applyPatch(fix) {
  const edits = fix.patch?.edits || [];
  if (!edits.length) {
    throw new Error('Fix has no patch edits');
  }

  const state = { files: {}, meta: {}, appliedPaths: [] };

  edits.forEach((edit) => {
    applyEdit(edit, state);
  });

  Object.entries(state.files).forEach(([rel, content]) => {
    if (content !== '') {
      const abs = writeFileRel(rel, content);
      state.appliedPaths.push(abs);
    }
  });

  return {
    ok: true,
    appliedFiles: Object.keys(state.files),
    meta: state.meta,
    appliedAt: new Date().toISOString()
  };
}

module.exports = { applyPatch, applyEdit };
