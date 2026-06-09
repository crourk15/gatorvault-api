/**
 * Site-wide floating feedback widget — all public pages.
 */
(function (global) {
  'use strict';

  var API =
    global.GV_API_BASE ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://gatorvault-api.onrender.com');

  var CATEGORIES = [
    'General',
    'Bug',
    'Feature Request',
    'Film Room',
    'Recruiting',
    'Live Feed',
    'Account / Billing',
    'Other'
  ];

  var rating = 0;
  var wired = false;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildUi() {
    if (document.getElementById('gv-feedback-fab')) return;

    var fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'gv-feedback-fab';
    fab.className = 'gv-feedback-fab';
    fab.setAttribute('aria-label', 'Send feedback');
    fab.innerHTML = '💬 Feedback';

    var ov = document.createElement('div');
    ov.id = 'gv-feedback-ov';
    ov.className = 'gv-feedback-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-hidden', 'true');

    var catOpts = CATEGORIES.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');

    ov.innerHTML =
      '<div class="gv-feedback-card-wrap">' +
      '<div class="gv-feedback-card">' +
      '<button type="button" class="gv-feedback-close" id="gv-feedback-close" aria-label="Close">&times;</button>' +
      '<h3>Send Feedback</h3>' +
      '<p class="gv-feedback-sub">Help us improve GatorVault — especially on mobile.</p>' +
      '<span class="gv-feedback-label">Rating</span>' +
      '<div class="gv-feedback-stars" id="gv-feedback-stars">' +
      [1, 2, 3, 4, 5]
        .map(function (n) {
          return (
            '<button type="button" class="gv-feedback-star" data-rating="' +
            n +
            '" aria-label="' +
            n +
            ' stars">★</button>'
          );
        })
        .join('') +
      '</div>' +
      '<label class="gv-feedback-label" for="gv-feedback-category">Category</label>' +
      '<select id="gv-feedback-category" class="gv-feedback-select">' +
      catOpts +
      '</select>' +
      '<label class="gv-feedback-label" for="gv-feedback-message">Message</label>' +
      '<textarea id="gv-feedback-message" class="gv-feedback-textarea" placeholder="What should we know?"></textarea>' +
      '<label class="gv-feedback-label" for="gv-feedback-email">Email (optional)</label>' +
      '<input id="gv-feedback-email" class="gv-feedback-input" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" />' +
      '<div class="gv-feedback-actions">' +
      '<button type="button" class="gv-feedback-submit" id="gv-feedback-submit">Submit</button>' +
      '<button type="button" class="gv-feedback-cancel" id="gv-feedback-cancel">Cancel</button>' +
      '</div>' +
      '<p class="gv-feedback-msg" id="gv-feedback-msg" aria-live="polite"></p>' +
      '</div></div>';

    document.body.appendChild(fab);
    document.body.appendChild(ov);
  }

  function setRating(n) {
    rating = n;
    document.querySelectorAll('.gv-feedback-star').forEach(function (btn) {
      var v = parseInt(btn.getAttribute('data-rating'), 10);
      btn.classList.toggle('is-on', v <= n);
    });
  }

  function openModal() {
    var ov = document.getElementById('gv-feedback-ov');
    if (!ov) return;
    ov.classList.add('is-open');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var msg = document.getElementById('gv-feedback-message');
    if (msg) setTimeout(function () { msg.focus(); }, 80);
  }

  function closeModal() {
    var ov = document.getElementById('gv-feedback-ov');
    if (!ov) return;
    ov.classList.remove('is-open');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showMsg(text, ok) {
    var el = document.getElementById('gv-feedback-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'gv-feedback-msg ' + (ok ? 'ok' : 'err');
  }

  function submitFeedback() {
    var messageEl = document.getElementById('gv-feedback-message');
    var emailEl = document.getElementById('gv-feedback-email');
    var catEl = document.getElementById('gv-feedback-category');
    var message = messageEl ? messageEl.value.trim() : '';
    var email = emailEl ? emailEl.value.trim() : '';
    var category = catEl ? catEl.value : 'General';

    if (!rating) {
      showMsg('Please select a rating (1–5 stars).', false);
      return;
    }
    if (message.length < 5) {
      showMsg('Please enter at least 5 characters.', false);
      return;
    }

    showMsg('Sending…', true);
    fetch(API + '/api/feedback/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: rating,
        category: category,
        message: message,
        email: email || undefined,
        page: location.pathname + location.search,
        tier: global.GV_ROLE || null
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Submit failed');
        showMsg('Thanks — your feedback was received!', true);
        if (messageEl) messageEl.value = '';
        if (emailEl) emailEl.value = '';
        setRating(0);
        setTimeout(closeModal, 1400);
      })
      .catch(function (e) {
        showMsg(e.message || 'Could not send feedback. Try again.', false);
      });
  }

  function wire() {
    if (wired) return;
    wired = true;
    buildUi();

    document.getElementById('gv-feedback-fab').addEventListener('click', openModal);
    document.getElementById('gv-feedback-close').addEventListener('click', closeModal);
    document.getElementById('gv-feedback-cancel').addEventListener('click', closeModal);
    document.getElementById('gv-feedback-submit').addEventListener('click', submitFeedback);
    document.getElementById('gv-feedback-ov').addEventListener('click', function (e) {
      if (e.target.id === 'gv-feedback-ov') closeModal();
    });
    document.querySelectorAll('.gv-feedback-star').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setRating(parseInt(btn.getAttribute('data-rating'), 10));
      });
    });
    document.addEventListener('keydown', function (e) {
      var ov = document.getElementById('gv-feedback-ov');
      if (e.key === 'Escape' && ov && ov.classList.contains('is-open')) closeModal();
    });
  }

  function init() {
    wire();
    fetch(API + '/api/feedback/categories')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok && j.categories && j.categories.length) {
          CATEGORIES = j.categories;
          var sel = document.getElementById('gv-feedback-category');
          if (sel) {
            sel.innerHTML = CATEGORIES.map(function (c) {
              return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
            }).join('');
          }
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GV_FEEDBACK = { open: openModal, close: closeModal };
})(window);
