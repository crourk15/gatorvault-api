#!/usr/bin/env node
/**
 * Fix blank Vault screens: Next export puts async React chunks in <head>, so they can
 * execute before #gv-vault-root and self.__next_f exist. Move all bundle scripts to the
 * end of <body> in source order, strip async/defer, remove head script preloads, and
 * keep webpack immediately before __next_f.
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');

const EXTERNAL_SRC =
  /<script\b([^>]*\bsrc=["'](?:\/js\/vault-chunks\/|\/_next\/static\/chunks\/)[^"']+["'][^>]*)>\s*<\/script>/gi;

const HEAD_SCRIPT_PRELOAD =
  /<link\b[^>]*\bas=["']script["'][^>]*\bhref=["'](?:\/js\/vault-chunks\/|\/_next\/static\/chunks\/)[^"']+["'][^>]*>/gi;

function isWebpackTag(tag) {
  return /webpack-[^"']+\.js/i.test(tag);
}

function isPolyfillTag(tag) {
  return /polyfills-[^"']+\.js/i.test(tag) || /\bnoModule\b/i.test(tag);
}

function stripAsyncDefer(tag) {
  return tag.replace(/\s(?:async|defer)(?:=(?:["'][^"']*["']|[^\s>]+))?/gi, '');
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function extractExternalScripts(html) {
  const tags = [];
  let next = html;
  let m;
  const re = new RegExp(EXTERNAL_SRC.source, 'gi');
  while ((m = re.exec(html))) {
    tags.push(`<script${m[1]}></script>`);
  }
  if (!tags.length) return { html, tags: [] };

  next = html.replace(new RegExp(EXTERNAL_SRC.source, 'gi'), '');
  return { html: next, tags };
}

function extractNextInlineScripts(html) {
  const tags = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi;
  let next = html;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].includes('__next_f') || m[0].includes('self.__next_f')) {
      tags.push(m[0]);
      next = next.replace(m[0], '');
    }
  }
  return { html: next, tags };
}

function removeHeadScriptPreloads(html) {
  return html.replace(new RegExp(HEAD_SCRIPT_PRELOAD.source, 'gi'), '');
}

function patchHtml(html) {
  let next = removeHeadScriptPreloads(html);

  if (!EXTERNAL_SRC.test(next)) {
    EXTERNAL_SRC.lastIndex = 0;
    return next;
  }
  EXTERNAL_SRC.lastIndex = 0;

  const pass1 = extractExternalScripts(next);
  next = pass1.html;
  const pass2 = extractNextInlineScripts(next);
  next = pass2.html;

  if (!pass1.tags.length) return html;

  const normalized = pass1.tags.map(stripAsyncDefer);
  const webpack = normalized.filter(isWebpackTag);
  const polyfills = normalized.filter((t) => isPolyfillTag(t) && !isWebpackTag(t));
  const chunks = normalized.filter((t) => !isWebpackTag(t) && !isPolyfillTag(t));

  /** Sync chunks register modules; webpack runs them; nomodule polyfills are legacy-only; __next_f bootstraps last. */
  const block = [...chunks, ...webpack, ...polyfills, ...pass2.tags].join('');
  if (next.includes('</body>')) {
    return next.replace('</body>', `${block}</body>`);
  }
  return next + block;
}

function injectScriptLoadOrder() {
  const files = walkHtml(serverDir);
  let updated = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('/js/vault-chunks/') && !html.includes('/_next/static/chunks/')) continue;
    const patched = patchHtml(html);
    if (patched !== html) {
      fs.writeFileSync(file, patched);
      updated += 1;
    }
  }
  console.log(`[inject-script-order] moved async head bundles to body end on ${updated}/${files.length} HTML shells`);
}

injectScriptLoadOrder();

module.exports = { injectScriptLoadOrder, patchHtml };
