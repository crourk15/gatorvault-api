#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { isPlaceholderSchool } = require('../lib/recruiting-placeholder-school');
const { getEditorialPosition } = require('../lib/recruiting-editorial-positions');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const BOARD_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');

function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const bySlug = new Map(players.map((p) => [String(p.slug).toLowerCase(), p]));
  const board = JSON.parse(fs.readFileSync(BOARD_PATH, 'utf8'));
  const boardBySlug = new Map((board.targets || []).map((t) => [String(t.slug).toLowerCase(), t]));
  const pending = [];
  const resolved = [];

  for (const slug of ALLOWLIST_2028) {
    const player = bySlug.get(slug);
    const boardRow = boardBySlug.get(slug);
    const editorial = getEditorialPosition(slug, 2028);
    const school = player?.school ?? boardRow?.school ?? null;
    const entry = {
      slug,
      name: player?.name ?? boardRow?.name ?? slug,
      pos: player?.pos ?? boardRow?.pos ?? editorial?.pos ?? null,
      school,
      state: player?.state ?? boardRow?.state ?? editorial?.state ?? null,
      on3Source: player?.on3Source ?? null,
      editorialSchool: editorial?.school ?? null,
    };
    if (isPlaceholderSchool(school) && isPlaceholderSchool(editorial?.school)) pending.push(entry);
    else resolved.push(entry);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        classYear: 2028,
        total: ALLOWLIST_2028.length,
        pendingCount: pending.length,
        resolvedCount: resolved.length,
        pending,
        resolved,
      },
      null,
      2
    )
  );
  if (pending.length) process.exitCode = 1;
}

main();
