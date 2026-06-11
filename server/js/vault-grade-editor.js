/**
 * VaultGradeEditor — Admin Hub component for real-time Vault Grade overrides.
 *
 * Usage:
 *   VaultGradeEditor.mount(container, { apiGet, apiPost, pin, onSaved });
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sourceLabel(source) {
    if (source === 'both') return 'Roster + Recruiting';
    if (source === 'recruiting') return 'Recruiting DB';
    return 'Roster DB';
  }

  function VaultGradeEditor(container, opts) {
    if (!container) throw new Error('VaultGradeEditor requires a container element');
    this.container = container;
    this.apiGet = opts.apiGet;
    this.apiPost = opts.apiPost;
    this.pin = opts.pin || function () { return ''; };
    this.onSaved = opts.onSaved || null;
    this.players = [];
    this.selected = null;
    this._debounce = null;
    this.render();
    this.loadPlayers();
  }

  VaultGradeEditor.prototype.render = function () {
    this.container.innerHTML =
      '<div class="vge-root">'
      + '<div class="vge-grid">'
      + '<div class="hub-card hub-card-wide vge-search-card">'
      + '<h3>Search Players</h3>'
      + '<p class="hub-meta">Search the Recruiting DB and Roster DB. Select a player to edit their Vault Grade.</p>'
      + '<label for="vge-search">Player name</label>'
      + '<div class="vge-search-wrap">'
      + '<input id="vge-search" type="search" autocomplete="off" placeholder="Start typing a name…">'
      + '<div id="vge-suggest" class="vge-suggest hidden" role="listbox"></div>'
      + '</div>'
      + '</div>'
      + '<div class="hub-card hub-card-wide vge-editor-card">'
      + '<h3>Player Identity</h3>'
      + '<div id="vge-identity" class="vge-identity vge-empty">Select a player from search results.</div>'
      + '<div id="vge-form" class="vge-form hidden">'
      + '<label for="vge-grade">Vault Grade <span class="vge-range">(0–100)</span></label>'
      + '<div class="vge-grade-row">'
      + '<input id="vge-grade" type="number" min="0" max="100" step="0.1" placeholder="87">'
      + '<button type="button" class="hub-btn" id="vge-save">Save Vault Grade</button>'
      + '<button type="button" class="hub-btn secondary" id="vge-clear">Clear Override</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div id="vge-toast" class="vge-toast hidden" role="status" aria-live="polite"></div>'
      + '</div>';

    var self = this;
    var searchEl = this.container.querySelector('#vge-search');
    searchEl.addEventListener('input', function (e) {
      clearTimeout(self._debounce);
      self._debounce = setTimeout(function () {
        self.renderSuggestions(e.target.value);
      }, 120);
    });
    searchEl.addEventListener('focus', function () {
      self.renderSuggestions(searchEl.value);
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.hideSuggestions();
    });
    document.addEventListener('click', function (e) {
      if (!self.container.contains(e.target)) self.hideSuggestions();
    });

    this.container.querySelector('#vge-save').addEventListener('click', function () {
      self.save(false);
    });
    this.container.querySelector('#vge-clear').addEventListener('click', function () {
      self.save(true);
    });
  };

  VaultGradeEditor.prototype.loadPlayers = function () {
    var self = this;
    this.apiGet('/api/admin/vault-grade/search?limit=5000')
      .then(function (j) {
        self.players = j.players || [];
      })
      .catch(function () {
        return Promise.all([
          self.apiGet('/api/roster/players'),
          self.apiGet('/api/players')
        ]).then(function (pair) {
          var roster = (pair[0].players || []).map(function (p) {
            return self.normalizeLocal(p, 'roster');
          });
          var recruits = (pair[1].players || pair[1] || []).map(function (p) {
            return self.normalizeLocal(p, 'recruiting');
          });
          var map = {};
          recruits.forEach(function (p) { if (p.slug) map[p.slug] = p; });
          roster.forEach(function (p) {
            if (!p.slug) return;
            if (map[p.slug]) {
              map[p.slug] = Object.assign({}, map[p.slug], p, { source: 'both', db: 'both' });
            } else {
              map[p.slug] = p;
            }
          });
          self.players = Object.keys(map).map(function (k) { return map[k]; });
        });
      })
      .catch(function (e) {
        self.toast('Failed to load players: ' + e.message, 'err');
      });
  };

  VaultGradeEditor.prototype.normalizeLocal = function (p, source) {
    var grade = p.ratingOverride != null ? p.ratingOverride : (p.vaultGrade != null ? p.vaultGrade : (p.displayRating != null ? p.displayRating : p.rating));
    return {
      playerId: p.id || p.slug,
      slug: p.slug,
      name: p.name,
      pos: p.pos || p.position,
      classYear: p.classYear || p.class || p.year,
      rating: p.rating != null ? Number(p.rating) : null,
      vaultGrade: grade != null ? Number(grade) : null,
      ratingOverride: p.ratingOverride != null ? Number(p.ratingOverride) : null,
      source: source,
      db: source
    };
  };

  VaultGradeEditor.prototype.renderSuggestions = function (query) {
    var suggest = this.container.querySelector('#vge-suggest');
    if (!suggest) return;
    var q = String(query || '').toLowerCase().trim();
    var rows = this.players;
    if (q) {
      rows = rows.filter(function (p) {
        return String(p.name || '').toLowerCase().indexOf(q) >= 0
          || String(p.slug || '').toLowerCase().indexOf(q) >= 0
          || String(p.pos || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    rows = rows.slice(0, 12);
    if (!rows.length) {
      suggest.innerHTML = '<div class="vge-suggest-empty">No players found.</div>';
      suggest.classList.remove('hidden');
      return;
    }
    var self = this;
    suggest.innerHTML = rows.map(function (p) {
      return '<button type="button" class="vge-suggest-item" data-id="' + esc(p.playerId || p.slug) + '" role="option">'
        + '<span class="vge-suggest-name">' + esc(p.name || p.slug) + '</span>'
        + '<span class="vge-suggest-meta">' + esc(p.pos || '—') + ' · ' + esc(p.classYear || '—') + ' · '
        + (p.vaultGrade != null ? esc(p.vaultGrade) : '—') + ' · ' + esc(sourceLabel(p.source || p.db)) + '</span>'
        + '</button>';
    }).join('');
    suggest.classList.remove('hidden');
    suggest.querySelectorAll('.vge-suggest-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var player = self.players.find(function (x) {
          return String(x.playerId || x.slug) === id || String(x.slug) === id;
        });
        if (player) self.selectPlayer(player);
        self.hideSuggestions();
      });
    });
  };

  VaultGradeEditor.prototype.hideSuggestions = function () {
    var suggest = this.container.querySelector('#vge-suggest');
    if (suggest) suggest.classList.add('hidden');
  };

  VaultGradeEditor.prototype.selectPlayer = function (player) {
    this.selected = player;
    var identity = this.container.querySelector('#vge-identity');
    var form = this.container.querySelector('#vge-form');
    var search = this.container.querySelector('#vge-search');
    if (search) search.value = player.name || '';
    if (identity) {
      identity.classList.remove('vge-empty');
      identity.innerHTML =
        '<div class="vge-id-grid">'
        + '<div><span class="vge-id-label">Name</span><strong>' + esc(player.name) + '</strong></div>'
        + '<div><span class="vge-id-label">Position</span><strong>' + esc(player.pos || '—') + '</strong></div>'
        + '<div><span class="vge-id-label">Class</span><strong>' + esc(player.classYear || '—') + '</strong></div>'
        + '<div><span class="vge-id-label">Rating</span><strong>' + (player.rating != null ? esc(player.rating) : '—') + '</strong></div>'
        + '<div><span class="vge-id-label">Current Vault Grade</span><strong class="vge-current-grade">' + (player.vaultGrade != null ? esc(player.vaultGrade) : '—') + '</strong></div>'
        + '<div><span class="vge-id-label">Database</span><strong>' + esc(sourceLabel(player.source || player.db)) + '</strong></div>'
        + '</div>';
    }
    if (form) {
      form.classList.remove('hidden');
      var gradeInput = this.container.querySelector('#vge-grade');
      if (gradeInput) gradeInput.value = player.ratingOverride != null ? player.ratingOverride : (player.vaultGrade != null ? player.vaultGrade : '');
    }
  };

  VaultGradeEditor.prototype.broadcastRefresh = function () {
    var ts = String(Date.now());
    try {
      localStorage.setItem('gv_roster_updated', ts);
      localStorage.setItem('gv_recruiting_updated', ts);
      localStorage.setItem('gv_vault_grade_updated', ts);
    } catch (e) { /* ignore */ }
  };

  VaultGradeEditor.prototype.save = function (clear) {
    var self = this;
    if (!this.selected) {
      this.toast('Select a player first', 'err');
      return;
    }
    var gradeEl = this.container.querySelector('#vge-grade');
    var payload = {
      playerId: this.selected.playerId || this.selected.slug,
      adminPin: this.pin()
    };
    if (clear) {
      payload.clear = true;
      payload.vaultGrade = null;
    } else {
      var raw = gradeEl ? gradeEl.value : '';
      if (raw === '' || raw == null) {
        this.toast('Enter a Vault Grade between 0 and 100', 'err');
        return;
      }
      var n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        this.toast('Vault Grade must be between 0 and 100', 'err');
        return;
      }
      payload.vaultGrade = n;
    }

    var saveBtn = this.container.querySelector('#vge-save');
    var clearBtn = this.container.querySelector('#vge-clear');
    if (saveBtn) saveBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    this.apiPost('/api/admin/vault-grade/update', payload)
      .then(function (j) {
        var grade = j.vaultGrade != null ? j.vaultGrade : (j.displayRating != null ? j.displayRating : null);
        self.selected.vaultGrade = grade;
        self.selected.ratingOverride = j.vaultGrade;
        var idx = self.players.findIndex(function (p) {
          return String(p.playerId || p.slug) === String(self.selected.playerId || self.selected.slug);
        });
        if (idx >= 0) {
          self.players[idx].vaultGrade = grade;
          self.players[idx].ratingOverride = j.vaultGrade;
        }
        self.selectPlayer(self.selected);
        self.broadcastRefresh();
        if (self.onSaved) self.onSaved(j);
        self.toast(clear ? 'Vault Grade override cleared — live sitewide' : 'Vault Grade saved — live sitewide', 'ok');
      })
      .catch(function (e) {
        self.toast(e.message || 'Save failed', 'err');
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
      });
  };

  VaultGradeEditor.prototype.toast = function (msg, kind) {
    var el = this.container.querySelector('#vge-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'vge-toast vge-toast-' + (kind || 'info');
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    var self = this;
    this._toastTimer = setTimeout(function () {
      el.classList.add('hidden');
    }, 3200);
  };

  VaultGradeEditor.mount = function (container, opts) {
    return new VaultGradeEditor(container, opts || {});
  };

  global.VaultGradeEditor = VaultGradeEditor;
})(typeof window !== 'undefined' ? window : global);
