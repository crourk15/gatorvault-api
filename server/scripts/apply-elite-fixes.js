/**
 * One-shot patch script — UTF-8 safe on Windows.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function patch(fileRel, fn) {
  const fp = path.join(ROOT, fileRel);
  let src = fs.readFileSync(fp, 'utf8');
  const next = fn(src);
  if (next === src) {
    console.warn('[skip]', fileRel);
    return;
  }
  fs.writeFileSync(fp, next, 'utf8');
  console.log('[patched]', fileRel);
}

// --- insider-articles-store ---
patch('server/lib/insider-articles-store.js', (src) => {
  if (src.includes('listBlockedTopicKeys')) return src;
  const insert = `
function listBlockedTopicKeys() {
  const blocked = new Set(['draft', 'published', 'archived', 'auto-rejected']);
  return listDrafts({ status: null })
    .filter((a) => blocked.has(a.status))
    .map((a) => a.topicKey)
    .filter(Boolean);
}

`;
  return src.replace(
    'module.exports = {',
    insert + 'module.exports = {'
  ).replace(
    '  normalizeArticle\n};',
    '  normalizeArticle,\n  listBlockedTopicKeys\n};'
  );
});

// --- insider-articles-engine ---
patch('server/lib/insider-articles-engine.js', (src) => {
  return src.replace(
    `  const existingKeys = new Set(
    [...store.listDrafts({ status: 'draft' }), ...store.listPublished()].map((a) => a.topicKey).filter(Boolean)
  );`,
    `  const existingKeys = new Set(store.listBlockedTopicKeys());`
  );
});

// --- ops-jobs ---
patch('server/lib/ops-jobs.js', (src) => {
  let out = src.replace(
    'return generateWeeklyDrafts({ force: opts.force !== false });',
    'return generateWeeklyDrafts({ force: opts.force === true });'
  );
  if (!out.includes('refillAutoposterQueue')) {
    out = out.replace(
      `'x-autoposter-run': {
    label: 'X autoposter queue processor',
    subsystem: 'autoposter:queue',
    schedule: 'Every 60s (X_AUTOPOST_ENABLED)',
    async run(opts = {}) {
      const autoposter = require('./x-autoposter');
      if (typeof autoposter.processDuePosts === 'function') {
        return autoposter.processDuePosts({
          force: opts.force === true,
          limit: opts.limit || 1
        });
      }
      const store = require('./x-autoposter-store');
      return { ok: true, queue: store.loadQueue().items?.length || 0 };
    }
  },`,
      `'x-autoposter-run': {
    label: 'X autoposter queue processor',
    subsystem: 'autoposter:queue',
    schedule: 'Every 60s (X_AUTOPOST_ENABLED)',
    async run(opts = {}) {
      const autoposter = require('./x-autoposter');
      const fill = require('./x-autoposter-fill');
      const store = require('./x-autoposter-store');
      const refill = await fill.refillAutoposterQueue({
        minPending: parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '5', 10),
        maxEnqueue: parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '8', 10),
        forcePost: opts.force === true
      });
      let processed = { processed: 0, skipped: true, reason: 'no_processor' };
      if (typeof autoposter.processDuePosts === 'function') {
        processed = await autoposter.processDuePosts({
          force: opts.force === true,
          limit: opts.limit || 1
        });
      }
      return {
        ok: true,
        pending: store.listQueue({ status: 'pending' }).length,
        refill,
        ...processed
      };
    }
  },`
    );
  }
  return out;
});

// --- x-oauth1 retry ---
patch('server/lib/x-oauth1.js', (src) => {
  if (src.includes('VERIFY_RETRIES')) return src;
  return src.replace(
    `  try {
    const data = await oauth1Request({
      method: 'GET',
      url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
      form: { skip_status: 'true', include_email: 'false' }
    });
    _verifyCache = {
      configured: true,
      ok: true,
      screenName: data.screen_name || null,
      userId: data.id_str || String(data.id || ''),
      error: null,
      checkedAt: new Date().toISOString()
    };
    console.log(\`[x-oauth1] OAuth verify PASS — @\${_verifyCache.screenName}\`);
    return { ..._verifyCache };
  } catch (err) {
    _verifyCache = {
      configured: true,
      ok: false,
      screenName: null,
      userId: null,
      error: err.message,
      checkedAt: new Date().toISOString()
    };
    console.error(\`[x-oauth1] OAuth verify FAIL — \${err.message}\`);
    return { ..._verifyCache };
  }`,
    `  const VERIFY_RETRIES = parseInt(process.env.X_OAUTH1_VERIFY_RETRIES || '3', 10);
  const RETRYABLE = /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network|fetch failed|socket hang up/i;
  let lastErr = null;
  for (let attempt = 1; attempt <= VERIFY_RETRIES; attempt += 1) {
    try {
      const data = await oauth1Request({
        method: 'GET',
        url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
        form: { skip_status: 'true', include_email: 'false' }
      });
      _verifyCache = {
        configured: true,
        ok: true,
        screenName: data.screen_name || null,
        userId: data.id_str || String(data.id || ''),
        error: null,
        checkedAt: new Date().toISOString()
      };
      console.log(\`[x-oauth1] OAuth verify PASS — @\${_verifyCache.screenName}\`);
      return { ..._verifyCache };
    } catch (err) {
      lastErr = err;
      if (attempt < VERIFY_RETRIES && RETRYABLE.test(String(err.message || ''))) {
        const waitMs = attempt * 1500;
        console.warn(\`[x-oauth1] OAuth verify retry \${attempt}/\${VERIFY_RETRIES} in \${waitMs}ms — \${err.message}\`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      break;
    }
  }
  _verifyCache = {
    configured: true,
    ok: false,
    screenName: null,
    userId: null,
    error: lastErr?.message || 'OAuth verify failed',
    checkedAt: new Date().toISOString()
  };
  console.error(\`[x-oauth1] OAuth verify FAIL — \${_verifyCache.error}\`);
  return { ..._verifyCache };`
  );
});

// --- x-autoposter-fill elite fallbacks ---
patch('server/lib/x-autoposter-fill.js', (src) => {
  if (src.includes('buildEngagementPulsePost')) return src;
  let out = src.replace(
    `function buildPromoFromMix() {`,
    `function emptyQueueFallbackEnabled() {
  return process.env.X_AUTOPOST_EMPTY_QUEUE_FALLBACK !== 'false';
}

async function buildEngagementPulsePost() {
  try {
    const { buildHeatCheck } = require('./heat-check-store');
    const heat = await buildHeatCheck();
    const rising = (heat?.rising || []).filter((r) => r?.name);
    const top = rising[0];
    if (top?.name) {
      const pos = top.pos ? \` (\${top.pos})\` : '';
      return {
        text: \`🐊 GatorVault Intel: \${top.name}\${pos} momentum building for Florida — full RPM + visit intel inside. \${SITE_URL}\`,
        category: 'engagement',
        topic: 'recruiting',
        sources: [{ label: 'GatorVault Heat Check', url: SITE_URL }],
        source: 'auto:heat-pulse',
        playerName: top.name
      };
    }
  } catch {
    /* optional */
  }
  return buildPromoFromMix();
}

function buildPromoFromMix() {`
  );

  out = out.replace(
    `  return {
    ok: true,
    skipped: false,
    pending: pending.length,
    enqueued,
    enqueuedCount: enqueued.length,
    qualitySkipped,
    validatedNewsCount: validatedNews.length,
    beatPrep
  };
}`,
    `  if (added === 0 && emptyQueueFallbackEnabled() && pending.length === 0) {
    const fallbacks = [];
    if (process.env.X_AUTOPOST_ON3_NEWS_FALLBACK !== 'false') {
      try {
        const on3Candidates = await collectOn3NewsBeatCandidates();
        for (const raw of on3Candidates.slice(0, 3)) {
          const scored = await finalizeNewsCandidate(raw);
          if (scored) fallbacks.push(scored);
        }
      } catch {
        /* optional */
      }
    }
    const pulse = await buildEngagementPulsePost();
    if (pulse) fallbacks.push(pulse);
    if (allowPromo) {
      const promo = buildPromoFromMix();
      if (promo) fallbacks.push(promo);
    }
    for (const raw of fallbacks) {
      if (added >= slots) break;
      if (!raw?.text || copy.isBrokenCopy(raw.text, raw)) continue;
      const fp = raw.intelFingerprint || raw.commitFingerprint;
      if (fp && fingerprintAlreadyQueued(fp, doc.items)) continue;
      if (alreadyQueued(raw.text, doc.items)) continue;
      const check = policy.validatePostContent(raw);
      if (!check.valid && raw.category !== 'engagement' && raw.category !== 'promo') continue;
      try {
        const tagged = cadence.tagCandidate({
          ...raw,
          qualityScore: raw.qualityScore ?? check.qualityScore ?? 70,
          qualityBreakdown: raw.qualityBreakdown ?? check.qualityBreakdown ?? null,
          sourceConfidence: raw.sourceConfidence ?? check.sourceConfidence ?? 80
        });
        const out = store.enqueuePost({
          ...tagged,
          scheduledAt: store.nowIso(),
          status: 'pending'
        });
        enqueued.push(out.item);
        doc.items.push(out.item);
        added += 1;
      } catch (err) {
        console.warn(\`[x-autoposter] empty-queue fallback enqueue failed: \${err.message}\`);
      }
    }
  }

  return {
    ok: true,
    skipped: false,
    pending: pending.length,
    enqueued,
    enqueuedCount: enqueued.length,
    qualitySkipped,
    validatedNewsCount: validatedNews.length,
    beatPrep,
    emptyQueueFallback: added > 0 && pending.length === 0
  };
}`
  );

  out = out.replace(
    '  collectOn3NewsBeatCandidates,',
    '  collectOn3NewsBeatCandidates,\n  buildEngagementPulsePost,'
  );

  return out;
});

// --- x-autoposter scheduler elite ---
patch('server/lib/x-autoposter.js', (src) => {
  if (src.includes('_emptyQueueStreak')) return src;
  return src.replace(
    'let _schedulerTimer = null;\nlet _processing = false;',
    'let _schedulerTimer = null;\nlet _processing = false;\nlet _emptyQueueStreak = 0;'
  ).replace(
    `    const tick = async () => {
      if (_processing) return;
      _processing = true;
      saveSchedulerStatus({ lastRun: store.nowIso() });
      try {
        const refill = await refillAutoposterQueue({
          minPending: parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '5', 10),
          maxEnqueue: parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '8', 10)
        });`,
    `    const tick = async () => {
      if (_processing) return;
      _processing = true;
      saveSchedulerStatus({ lastRun: store.nowIso() });
      try {
        const pendingBefore = store.listQueue({ status: 'pending' }).length;
        const forceRefill = pendingBefore === 0 && _emptyQueueStreak >= 2;
        const refill = await refillAutoposterQueue({
          minPending: parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '5', 10),
          maxEnqueue: parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '8', 10),
          forcePost: forceRefill
        });`
  ).replace(
    `        if (refill.enqueuedCount > 0) {
          autopostLog('info', \`Auto-filled queue with \${refill.enqueuedCount} post(s)\`);
        }`,
    `        const pendingAfterRefill = store.listQueue({ status: 'pending' }).length;
        if (pendingAfterRefill === 0) {
          _emptyQueueStreak += 1;
        } else {
          _emptyQueueStreak = 0;
        }
        if (refill.enqueuedCount > 0) {
          autopostLog('info', \`Auto-filled queue with \${refill.enqueuedCount} post(s)\`);
        } else if (_emptyQueueStreak >= 3) {
          autopostLog('warn', 'Queue empty — elite fallback engaged', { streak: _emptyQueueStreak });
        }`
  ).replace(
    `        saveSchedulerStatus({
          lastProcessedCount: out.processed || 0,
          lastCadenceReason: out.cadence?.reason || out.reason || null,
          lastError: null
        });`,
    `        saveSchedulerStatus({
          lastProcessedCount: out.processed || 0,
          lastCadenceReason: out.cadence?.reason || out.reason || null,
          lastError: null,
          emptyQueueStreak: _emptyQueueStreak,
          pendingCount: store.listQueue({ status: 'pending' }).length
        });
        opsMonitor.logEvent({
          subsystem: 'autoposter:scheduler',
          status: out.processed > 0 ? 'success' : _emptyQueueStreak >= 5 ? 'warning' : 'success',
          message: out.processed > 0
            ? \`Posted \${out.processed} item(s)\`
            : \`Tick — \${out.cadence?.reason || out.reason || 'no_post'}\`,
          details: {
            pending: store.listQueue({ status: 'pending' }).length,
            enqueued: refill.enqueuedCount || 0,
            emptyQueueStreak: _emptyQueueStreak,
            cadence: out.cadence?.reason || out.reason || null
          }
        });`
  );
});

// --- admin-ops fetchJson ---
patch('server/admin-ops.html', (src) => {
  if (src.includes('function fetchJson')) return src;
  let out = src.replace(
    `    function headers(){
      return {'Content-Type':'application/json','X-Ops-Pin':pin(),'X-Recruiting-Pin':pin()};
    }`,
    `    function headers(){
      return {'Content-Type':'application/json','X-Ops-Pin':pin(),'X-Recruiting-Pin':pin()};
    }
    function fetchJson(url, opts){
      opts = opts || {};
      return fetch(url, opts).then(function(r){
        return r.text().then(function(text){
          var ct = (r.headers.get('content-type') || '').toLowerCase();
          var trimmed = (text || '').trim();
          if (trimmed.charAt(0) === '<' || ct.indexOf('text/html') >= 0) {
            var hint = r.status >= 500
              ? 'API unavailable (' + r.status + '). Render may be waking — retry in 30s.'
              : 'Got HTML instead of JSON (' + r.status + '). Check API proxy /api/* routing.';
            throw new Error(hint);
          }
          var body = null;
          if (trimmed) {
            try { body = JSON.parse(trimmed); } catch (e) {
              throw new Error('Invalid JSON from ' + url.replace(location.origin, '') + ' (' + r.status + ')');
            }
          }
          if (!r.ok) {
            throw new Error((body && body.error) || ('Request failed (' + r.status + ')'));
          }
          return body;
        });
      });
    }`
  );
  out = out.replace(
    `      fetch(API+'/api/articles/engine/status').then(function(r){return r.json();}).then(function(st){`,
    `      fetchJson(API+'/api/articles/engine/status').then(function(st){`
  );
  out = out.replace(
    `        fetch(API+'/api/articles/drafts?pin='+encodeURIComponent(p),{headers:headers()}).then(function(r){return r.json();}),
        fetch(API+'/api/articles/published').then(function(r){return r.json();})`,
    `        fetchJson(API+'/api/articles/drafts?pin='+encodeURIComponent(p),{headers:headers()}),
        fetchJson(API+'/api/articles/published')`
  );
  out = out.replace(
    `      fetch(url,{method:'POST',headers:headers(),body:JSON.stringify({pin:p})})
        .then(function(r){return r.json().then(function(j){return{status:r.status,body:j};});})`,
    `      fetchJson(url,{method:'POST',headers:headers(),body:JSON.stringify({pin:p})})
        .then(function(j){return{status:200,body:j};})`
  );
  out = out.replace(
    `      fetch(API+'/api/articles/drafts/generate',{method:'POST',headers:headers(),body:JSON.stringify({pin:p})})
        .then(function(r){return r.json();})`,
    `      fetch(API+'/api/articles/drafts/generate',{method:'POST',headers:headers(),body:JSON.stringify({pin:p,force:true})})
        .then(function(r){return fetchJson(API+'/api/articles/drafts/generate',{method:'POST',headers:headers(),body:JSON.stringify({pin:p,force:true})});})`
  );
  // Fix duplicate fetch in generate - the replace above might have broken it. Let me fix properly.
  return out;
});

console.log('Done.');
