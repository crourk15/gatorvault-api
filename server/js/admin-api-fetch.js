/**
 * Shared Admin Hub fetch helpers — safe JSON parsing when Render/Netlify returns HTML.
 */
(function (global) {
  function responseLooksLikeHtml(text, contentType) {
    var ct = String(contentType || '').toLowerCase();
    var trimmed = String(text || '').trim();
    return ct.indexOf('text/html') >= 0 || trimmed.charAt(0) === '<';
  }

  function infraMessage(status) {
    if (status >= 500 || status === 504) {
      return 'API unavailable (' + status + '). Render may be waking — retry in 30s.';
    }
    if (status === 503) {
      return 'API warming up (503). Retry in a few seconds.';
    }
    return 'Got HTML instead of JSON (' + status + '). Check /api/* proxy to Render.';
  }

  function parseApiResponse(r, text, url) {
    if (responseLooksLikeHtml(text, r.headers && r.headers.get && r.headers.get('content-type'))) {
      throw new Error(infraMessage(r.status));
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
      throw new Error(infraMessage(r.status) || 'Empty server response (' + r.status + ').');
    } else {
      throw new Error('Empty server response. API may be starting — retry in 30s.');
    }
    if (r.status === 401) {
      throw new Error((body && body.error) || 'Invalid PIN — check Render OPS_ADMIN_PIN / RECRUITING_ADMIN_PIN');
    }
    if (!r.ok) {
      throw new Error((body && body.error) || ('Request failed (' + r.status + ')'));
    }
    return body;
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (text) {
        return parseApiResponse(r, text, url);
      });
    });
  }

  global.GVAdminApiFetch = {
    responseLooksLikeHtml: responseLooksLikeHtml,
    infraMessage: infraMessage,
    parseApiResponse: parseApiResponse,
    fetchJson: fetchJson
  };
})(typeof window !== 'undefined' ? window : global);
