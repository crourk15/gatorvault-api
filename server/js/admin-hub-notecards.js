/**
 * Operator Notecards — plain-English playbook for Charles.
 * Shared by Beat Desk + Command Center.
 */
(function (global) {
  var STORAGE_KEY = 'gv:hub:notecards:collapsed';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function isCollapsed() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setCollapsed(on) {
    try {
      sessionStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  /**
   * @param {'desk'|'command'} variant
   * @param {{ onNavigate?: Function }} [opts]
   */
  function html(variant, opts) {
    opts = opts || {};
    var collapsed = isCollapsed();
    var deskFocus = variant === 'desk';

    var todaySteps = deskFocus
      ? [
          'Look at today’s beats in the list below.',
          'Press <strong>Open</strong> on the one you want to post about.',
          'Read the packet — Why Florida + Vault angle + <strong>Film / highlights</strong> + <strong>Projection / Comp</strong> + board facts.',
          'Press <strong>Copy Brief</strong>, paste into Cursor/Copilot, then post on X — require <strong>HEADER</strong> + deeper film eval + projection + player comp every time.',
          'Check the green <strong>FutureCast feed</strong> card — that means the board got the update too.'
        ]
      : [
          'If everything looks green / “All clear,” go to <strong>Beat Desk</strong> and make today’s posts.',
          'If something is red/yellow up top, follow the <strong>If red / yellow</strong> card — then come back to posting.',
          'Use <strong>FutureCast</strong> when you want to see who is on the 2028 board / allowlist.',
          'Ignore <strong>Legacy consoles</strong> unless support or content asks for them.'
        ];

    var buttons = deskFocus
      ? [
          ['Open', 'Builds the full player packet (research + board + draft angle).'],
          ['Copy Brief', 'Puts the packet on your clipboard for Cursor / Copilot — HEADER + film + projection/comp are always required in the draft.'],
          ['Film card', 'Copy Brief includes the Hudl/On3 highlight LINK — Cursor reviews it in depth (2–3 tape specifics), then drafts.'],
          ['Projection / Comp card', 'Contribution path (when / role / ceiling) + body+traits-matched comparable. Always in the X post — agent drafts if War Room is empty.'],
          ['Refresh', 'Reloads today’s beat list from the kitchen.'],
          ['Check API', 'Pings the server — if it says waking, wait and try again.'],
          ['FutureCast card', 'Shows if this Open seeded/updated the recruiting board.']
        ]
      : [
          ['Beat Desk', 'Your daily posting desk — start here most days.'],
          ['FutureCast', 'Who’s on the board / allowlist. Check Vault feed 2028+ proof (7am/7pm) — created/updated lists must be real names.'],
          ['Runbooks', 'Only if something is broken (QA red, ingest lag, deploy).'],
          ['Job Queue', 'Safe re-runs. Don’t spam buttons — one job at a time.'],
          ['Members', 'Who signed up recently (trial / paid / expired).']
        ];

    var ifRedYellow = deskFocus
      ? [
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>STALE</strong> (red/yellow on a beat row)',
           'That beat is older than 24 hours — not broken. You can still press <strong>Open</strong> for a catch-up post. Prefer a LIVE row when you have one.'],
          ['<span class="hub-nc-dot hub-nc-dot--green"></span><strong>LIVE</strong>',
           'Fresh beat. This is the best one to Open and post.'],
          ['<span class="hub-nc-dot hub-nc-dot--yellow"></span><strong>Waking / kitchen busy</strong>',
           'Server is starting. Wait 20–40 seconds, press <strong>Refresh</strong>. Don’t click a dozen times.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>FAIL / error / Open won’t load</strong>',
           'Press <strong>Check API</strong>. If still bad, wait a minute + Refresh. If it keeps failing, open <strong>Runbooks → Deploy recovery</strong>.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>Film Room Engine red (or “Catalog …h ago”)</strong>',
           'Catalog is stale. Click <strong>Rebuild Film Room catalog</strong> (orange Fix button / Re-run). Wait 1–2 minutes, Refresh. Not a Beat Desk problem.'],
          ['<span class="hub-nc-dot hub-nc-dot--yellow"></span><strong>App Store gate / product_intel_below_90 (Top Issue)</strong>',
           'Ignore for posting. Scorecard issue — open Command Center Coach later. Keep using Beat Desk.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>Flashing red “API DOWN” banner</strong>',
           'Render is 502 — App Store login will fail. Restart/redeploy <strong>gatorvault-api</strong> on Render. Orange “waking” is fine; flashing red is not.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>Beat Desk sidebar dot is red</strong>',
           'API is actually failing (not Film Room / wake lag). Press <strong>Check API</strong>, wait a minute, Refresh. Film Room red shows under Content — keep posting if BD is green/yellow.'],
          ['<span class="hub-nc-dot hub-nc-dot--yellow"></span><strong>Dashboard yellow while Beat Desk green</strong>',
           'Normal. Dashboard shows kitchen noise (wake lag, drafts, Film Room). Beat Desk green means you can still post.']
        ]
      : [
          ['<span class="hub-nc-dot hub-nc-dot--yellow"></span><strong>App Store gate / product_intel_below_90</strong>',
           'Product Health score is under 90. That is an internal report card — <strong>not Apple rejecting you</strong>. Open Product Health → Recompute. Fix red ops tiles first (they drag the score down). Keep posting on Beat Desk.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>Flashing red “API DOWN” banner / tab title</strong>',
           'Not kitchen wake. Restart or redeploy Render <strong>gatorvault-api</strong> — War Room + App Store login fail until it recovers.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>Top issue is red</strong>',
           'Read the yellow “What to do” line / <strong>Coach says</strong> box. Press the orange Fix button. Don’t just open Full Ops and guess.'],
          ['<span class="hub-nc-dot hub-nc-dot--yellow"></span><strong>Yellow module / backlog</strong>',
           'Finish today’s posts first if you can. Then open that yellow module when you have a minute.'],
          ['<span class="hub-nc-dot hub-nc-dot--red"></span><strong>QA is red</strong>',
           'Open <strong>QA Monitor</strong> or Runbooks → “QA is red”. Don’t ignore a red QA for days.'],
          ['<span class="hub-nc-dot hub-nc-dot--yellow"></span><strong>Kitchen waking on any page</strong>',
           'Wait 20–40s and Refresh. Normal after the server sleeps. If the banner turns flashing red, treat it as API DOWN.'],
          ['<span class="hub-nc-dot hub-nc-dot--gray"></span><strong>Gray dots</strong>',
           'No probe yet — not an emergency. Keep using Beat Desk.']
        ];

    var ignore = deskFocus
      ? 'Skip Full Ops, Self-Runner, and Legacy consoles unless fixing a break. Open <strong>Product Health</strong> only when Coach / Top Issue says the App Store gate score is low.'
      : 'Skip Content / Community / Feedback / Player Intel / Self-Runner (Legacy) unless you have a specific support or content task.';

    var stepsHtml = todaySteps
      .map(function (s, i) {
        return '<li><span class="hub-nc-num">' + (i + 1) + '</span><span>' + s + '</span></li>';
      })
      .join('');

    var btnHtml = buttons
      .map(function (row) {
        return '<div class="hub-nc-btn-row"><strong>' + esc(row[0]) + '</strong><span>' + esc(row[1]) + '</span></div>';
      })
      .join('');

    var redHtml = ifRedYellow
      .map(function (row) {
        return '<div class="hub-nc-alert-row">'
          + '<div class="hub-nc-alert-title">' + row[0] + '</div>'
          + '<div class="hub-nc-alert-body">' + row[1] + '</div>'
          + '</div>';
      })
      .join('');

    return ''
      + '<section class="hub-notecards' + (collapsed ? ' is-collapsed' : '') + '" id="hub-notecards" aria-label="Operator notecards">'
      + '<div class="hub-notecards__head">'
      + '<div>'
      + '<p class="hub-notecards__eyebrow">Operator notecards</p>'
      + '<h3 class="hub-notecards__title">' + (deskFocus ? 'Your daily posting playbook' : 'How to run this hub') + '</h3>'
      + '<p class="hub-notecards__sub">Plain English. Do the numbered steps. If something is red or yellow, use the card below — don’t guess.</p>'
      + '</div>'
      + '<button type="button" class="hub-btn secondary" id="hub-nc-toggle" aria-expanded="' + (collapsed ? 'false' : 'true') + '">'
      + (collapsed ? 'Show notecards' : 'Hide notecards')
      + '</button>'
      + '</div>'
      + '<div class="hub-notecards__body">'
      + '<div class="hub-nc-grid">'
      + '<article class="hub-nc-card hub-nc-card--do">'
      + '<h4>Do this now</h4>'
      + '<ol class="hub-nc-steps">' + stepsHtml + '</ol>'
      + (deskFocus
        ? ''
        : '<p class="hub-nc-cta"><button type="button" class="hub-btn" data-nc-route="#beat-desk/desk">Go to Beat Desk</button></p>')
      + '</article>'
      + '<article class="hub-nc-card hub-nc-card--alert">'
      + '<h4>If red / yellow — do this</h4>'
      + '<div class="hub-nc-alerts">' + redHtml + '</div>'
      + '</article>'
      + '<article class="hub-nc-card">'
      + '<h4>What the buttons mean</h4>'
      + '<div class="hub-nc-buttons">' + btnHtml + '</div>'
      + '</article>'
      + (deskFocus
        ? '<article class="hub-nc-card">'
          + '<h4>Header + Projection / Comp (every recruit post)</h4>'
          + '<p><strong>HEADER</strong> = elite intel leap above the post (required) — same urgency as top recruiting hooks, but original Vault wording every time. Never clone “New intel has emerged…” Never “owns” a recruit.</p>'
          + '<p style="margin:8px 0 0"><strong>Projection</strong> = when he contributes + role + ceiling — written for the position. QB = develop → compete for the job → starter upside (never “rotational QB”). EDGE/WR/DL can use rotation/every-down when true. Sell the upside — never write “not All-American.”</p>'
          + '<p style="margin:8px 0 0"><strong>GatorVault player comp</strong> = <em>body size first</em> (height within ~1–2", same frame), then win traits from tape, then projection band. A 6-5 recruit cannot comp to a 6-1 QB. Not size-only. Don’t default to Florida alumni.</p>'
          + '<p class="hub-meta" style="margin:8px 0 0">If War Room says none on file, Cursor drafts both from tape + board, then <strong style="color:#fff">must persist</strong> via <code>upsert-vault-film-eval.js</code> so the profile/FutureCast card updates. Confirm before treating a brand-new eval as live card copy.</p>'
          + '</article>'
        : '')
      + '<article class="hub-nc-card hub-nc-card--ignore">'
      + '<h4>Don’t touch (unless red / asked)</h4>'
      + '<p>' + ignore + '</p>'
      + '<p class="hub-meta" style="margin:10px 0 0">Sidebar dots: <strong style="color:#86efac">green</strong> = healthy · '
      + '<strong style="color:#fde047">yellow</strong> = warning · '
      + '<strong style="color:#fca5a5">red</strong> = failed · '
      + '<strong style="color:#94a3b8">gray</strong> = unknown (not urgent).</p>'
      + '</article>'
      + '</div>'
      + '</div>'
      + '</section>';
  }

  function wire(root, opts) {
    opts = opts || {};
    if (!root) return;
    var section = root.querySelector('#hub-notecards') || (root.id === 'hub-notecards' ? root : null);
    if (!section) return;
    var toggle = section.querySelector('#hub-nc-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var next = !section.classList.contains('is-collapsed');
        section.classList.toggle('is-collapsed', next);
        setCollapsed(next);
        toggle.textContent = next ? 'Show notecards' : 'Hide notecards';
        toggle.setAttribute('aria-expanded', next ? 'false' : 'true');
      });
    }
    section.querySelectorAll('[data-nc-route]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var route = btn.getAttribute('data-nc-route');
        if (route && typeof opts.onNavigate === 'function') opts.onNavigate(route);
      });
    });
  }

  function mount(container, variant, opts) {
    if (!container) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = html(variant, opts);
    var node = wrap.firstChild;
    container.insertBefore(node, container.firstChild);
    wire(node, opts);
    return node;
  }

  global.GVAdminNotecards = {
    html: html,
    wire: wire,
    mount: mount
  };
})(window);
