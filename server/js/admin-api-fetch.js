/**
 * Shared Admin Hub fetch helpers — wake-first JSON fetch with quiet retries.
 * Goal: never dump raw 502 spam at Charles; wake kitchen, then load.
 */
(function (global) {
  var RETRY_STATUSES = { 429: 1, 502: 1, 503: 1, 504: 1 };
  var DEFAULT_RETRIES = 6;
  var DEFAULT_RETRY_MS = 2000;
  var WAKE_TTL_MS = 45000;
  var wakeState = { promise: null, readyAt: 0, lastError: null };

  function responseLooksLikeHtml(text, contentType) {
    var ct = String(contentType || '').toLowerCase();
    var trimmed = String(text || '').trim();
    return ct.indexOf('text/html') >= 0 || trimmed.charAt(0) === '<';
  }

  function softWakeMessage(status, attempt, maxAttempts) {
    var n = (attempt || 0) + 1;
    var of = maxAttempts != null ? ' (' + n + '/' + maxAttempts + ')' : '';
    if (status === 503) return 'Waking kitchen' + of + '…';
    if (status === 429) return 'Kitchen rate-limited' + of + ' — waiting…';
    if (status === 502 || status === 504 || (status != null && status >= 500)) {
      return 'Waking kitchen' + of + '…';
    }
    return 'Connecting to kitchen' + of + '…';
  }

  /** @deprecated Prefer softWakeMessage — kept for callers that still read infraMessage. */
  function infraMessage(status) {
    return softWakeMessage(status, 0, null);
  }

  function parseApiResponse(r, text, url) {
    if (responseLooksLikeHtml(text, r.headers && r.headers.get && r.headers.get('content-type'))) {
      var err = new Error(softWakeMessage(r.status, 0, null));
      err.status = r.status;
      err.retryable = !!RETRY_STATUSES[r.status] || r.status >= 500;
      err.wake = true;
      throw err;
    }
    var trimmed = String(text || '').trim();
    var body = null;
    if (trimmed) {
      try {
        body = JSON.parse(trimmed);
      } catch (e) {
        throw new Error(
          'Invalid JSON from ' + String(url || '').replace(global.location ? global.location.origin : '', '') +
            ' (' + r.status + ')'
        );
      }
    } else if (!r.ok) {
      var emptyErr = new Error(softWakeMessage(r.status, 0, null));
      emptyErr.status = r.status;
      emptyErr.retryable = !!RETRY_STATUSES[r.status];
      emptyErr.wake = true;
      throw emptyErr;
    } else {
      var emptyOk = new Error('Kitchen starting — reconnecting…');
      emptyOk.retryable = true;
      emptyOk.wake = true;
      throw emptyOk;
    }
    if (r.status === 401) {
      throw new Error((body && body.error) || 'Invalid PIN — check Render OPS_ADMIN_PIN / RECRUITING_ADMIN_PIN');
    }
    if (!r.ok) {
      var fail = new Error((body && body.error) || ('Request failed (' + r.status + ')'));
      fail.status = r.status;
      fail.retryable = !!RETRY_STATUSES[r.status];
      fail.wake = !!RETRY_STATUSES[r.status];
      throw fail;
    }
    return body;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function isRetryableError(err, status) {
    if (status != null && RETRY_STATUSES[status]) return true;
    if (err && err.retryable) return true;
    if (err && err.status != null && RETRY_STATUSES[err.status]) return true;
    var msg = String((err && err.message) || err || '');
    return /kitchen|waking|warming|unavailable|502|503|504|Failed to fetch|NetworkError|Load failed|starting|reconnect/i.test(msg);
  }

  function fetchJsonOnce(url, opts) {
    return fetch(url, opts || {}).then(function (r) {
      return r.text().then(function (text) {
        return parseApiResponse(r, text, url);
      });
    });
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    var retries = opts.retries != null ? opts.retries : DEFAULT_RETRIES;
    var retryDelayMs = opts.retryDelayMs != null ? opts.retryDelayMs : DEFAULT_RETRY_MS;
    var onAttempt = typeof opts.onAttempt === 'function' ? opts.onAttempt : null;
    var fetchOpts = Object.assign({}, opts);
    delete fetchOpts.retries;
    delete fetchOpts.retryDelayMs;
    delete fetchOpts.onAttempt;
    delete fetchOpts.skipWake;

    var attempt = 0;
    var maxAttempts = retries + 1;

    function run() {
      if (onAttempt) {
        try { onAttempt({ attempt: attempt, maxAttempts: maxAttempts, url: url }); } catch (e) { /* ignore */ }
      }
      return fetchJsonOnce(url, fetchOpts).catch(function (err) {
        var status = err && err.status;
        if (attempt >= retries || !isRetryableError(err, status)) {
          // Final failure after wake retries — plain English for Charles, not “Waking kitchen…”.
          if (err && (err.wake || isRetryableError(err, status) || /waking kitchen|kitchen starting|connecting to kitchen/i.test(String(err.message || '')))) {
            err.message = 'Server still starting after several tries. Wait 2 minutes, then try again.';
            err.wake = true;
          }
          throw err;
        }
        var msg = softWakeMessage(status, attempt, maxAttempts);
        err.message = msg;
        if (onAttempt) {
          try { onAttempt({ attempt: attempt, maxAttempts: maxAttempts, url: url, error: err, status: status }); } catch (e2) { /* ignore */ }
        }
        attempt += 1;
        // Exponential-ish backoff: 2s, 4s, 6s, 8s… capped at 10s
        var delay = Math.min(10000, retryDelayMs * attempt);
        return sleep(delay).then(run);
      });
    }

    return run();
  }

  function apiBaseFromUrl(url) {
    try {
      if (global.location && global.location.origin) return global.location.origin;
    } catch (e) { /* ignore */ }
    var m = String(url || '').match(/^(https?:\/\/[^/]+)/i);
    return m ? m[1] : '';
  }

  /**
   * Shared wake latch — one /api/ping storm, reused for ~45s.
   */
  function ensureAwake(apiBase, opts) {
    opts = opts || {};
    var base = String(apiBase || '').replace(/\/$/, '');
    if (!base && global.location) base = global.location.origin;
    var now = Date.now();
    if (wakeState.readyAt && now - wakeState.readyAt < WAKE_TTL_MS) {
      return Promise.resolve({ ok: true, cached: true });
    }
    if (wakeState.promise) return wakeState.promise;

    var pingUrl = base + '/api/ping';
    wakeState.promise = fetchJson(pingUrl, {
      retries: opts.retries != null ? opts.retries : 8,
      retryDelayMs: opts.retryDelayMs != null ? opts.retryDelayMs : 2500,
      onAttempt: opts.onAttempt,
      headers: Object.assign({ Accept: 'application/json' }, opts.headers || {})
    })
      .then(function (body) {
        wakeState.readyAt = Date.now();
        wakeState.lastError = null;
        return body || { ok: true };
      })
      .catch(function (err) {
        wakeState.lastError = err;
        throw err;
      })
      .finally(function () {
        wakeState.promise = null;
      });

    return wakeState.promise;
  }

  function fetchJsonAwake(url, opts) {
    opts = opts || {};
    if (opts.skipWake) return fetchJson(url, opts);
    var base = apiBaseFromUrl(url);
    var wakeOpts = {
      onAttempt: opts.onAttempt,
      headers: opts.headers
    };
    return ensureAwake(base, wakeOpts).then(function () {
      return fetchJson(url, opts);
    });
  }

  global.GVAdminApiFetch = {
    responseLooksLikeHtml: responseLooksLikeHtml,
    infraMessage: infraMessage,
    softWakeMessage: softWakeMessage,
    parseApiResponse: parseApiResponse,
    fetchJson: fetchJson,
    fetchJsonAwake: fetchJsonAwake,
    ensureAwake: ensureAwake,
    isRetryableError: isRetryableError
  };
})(typeof window !== 'undefined' ? window : global);
