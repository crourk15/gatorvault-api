/**
 * Shared Admin Hub fetch helpers — safe JSON parsing + quiet wake retries.
 */
(function (global) {
  var RETRY_STATUSES = { 429: 1, 502: 1, 503: 1, 504: 1 };
  var DEFAULT_RETRIES = 3;
  var DEFAULT_RETRY_MS = 1500;

  function responseLooksLikeHtml(text, contentType) {
    var ct = String(contentType || '').toLowerCase();
    var trimmed = String(text || '').trim();
    return ct.indexOf('text/html') >= 0 || trimmed.charAt(0) === '<';
  }

  function infraMessage(status) {
    if (status >= 500 || status === 504 || status === 502) {
      return 'Kitchen busy (' + status + '). Retrying quietly…';
    }
    if (status === 503) {
      return 'API warming (503). Retrying quietly…';
    }
    return 'Got HTML instead of JSON (' + status + '). Check /api/* proxy to Render.';
  }

  function parseApiResponse(r, text, url) {
    if (responseLooksLikeHtml(text, r.headers && r.headers.get && r.headers.get('content-type'))) {
      var err = new Error(infraMessage(r.status));
      err.status = r.status;
      err.retryable = !!RETRY_STATUSES[r.status] || r.status >= 500;
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
      var emptyErr = new Error(infraMessage(r.status) || 'Empty server response (' + r.status + ').');
      emptyErr.status = r.status;
      emptyErr.retryable = !!RETRY_STATUSES[r.status];
      throw emptyErr;
    } else {
      throw new Error('Empty server response. Kitchen may be starting — retrying…');
    }
    if (r.status === 401) {
      throw new Error((body && body.error) || 'Invalid PIN — check Render OPS_ADMIN_PIN / RECRUITING_ADMIN_PIN');
    }
    if (!r.ok) {
      var fail = new Error((body && body.error) || ('Request failed (' + r.status + ')'));
      fail.status = r.status;
      fail.retryable = !!RETRY_STATUSES[r.status];
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
    return /kitchen busy|warming|unavailable|502|503|504|Failed to fetch|NetworkError|Load failed/i.test(msg);
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
    var fetchOpts = Object.assign({}, opts);
    delete fetchOpts.retries;
    delete fetchOpts.retryDelayMs;

    var attempt = 0;
    var lastErr = null;

    function run() {
      return fetchJsonOnce(url, fetchOpts).catch(function (err) {
        lastErr = err;
        var status = err && err.status;
        if (attempt >= retries || !isRetryableError(err, status)) {
          throw err;
        }
        attempt += 1;
        return sleep(retryDelayMs * attempt).then(run);
      });
    }

    return run();
  }

  global.GVAdminApiFetch = {
    responseLooksLikeHtml: responseLooksLikeHtml,
    infraMessage: infraMessage,
    parseApiResponse: parseApiResponse,
    fetchJson: fetchJson,
    isRetryableError: isRetryableError
  };
})(typeof window !== 'undefined' ? window : global);
