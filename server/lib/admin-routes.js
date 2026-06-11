const path = require('path');

/** Legacy admin URLs → unified hub hash routes */
const ADMIN_HUB_REDIRECTS = [
  ['/admin/feedback', '/admin#feedback'],
  ['/admin/monitoring', '/admin#recruiting/monitoring'],
  ['/admin/ops', '/admin#dashboard'],
  ['/admin/ops/gm2', '/admin#gm2/integrity'],
  ['/admin/ops/identity-patterns', '/admin#gm2/identity'],
  ['/vault/ops', '/admin#dashboard'],
  ['/recruiting-admin.html', '/admin#recruiting/alerts'],
  ['/content-admin.html', '/admin#content/content-accuracy'],
  ['/community-admin.html', '/admin#community/moderation'],
  ['/war-room-admin.html', '/admin#team/war-room'],
  ['/admin-feedback.html', '/admin#feedback/inbox'],
  ['/admin-monitoring.html', '/admin#recruiting/monitoring'],
  ['/admin-ops.html', '/admin#dashboard'],
  ['/admin-qa.html', '/admin#dashboard/qa'],
  ['/admin-ops-gm2.html', '/admin#gm2/integrity'],
  ['/admin-ops-identity-patterns.html', '/admin#gm2/identity']
];

/** Embed panel pages (served to iframes inside the hub) */
const ADMIN_EMBED_PAGES = {
  ops: 'admin-ops.html',
  feedback: 'admin-feedback.html',
  monitoring: 'admin-monitoring.html',
  'recruiting-alerts': 'recruiting-admin.html',
  board: 'recruiting-board.html',
  content: 'content-admin.html',
  community: 'community-admin.html',
  'war-room': 'war-room-admin.html',
  gm2: 'admin-ops-gm2.html',
  identity: 'admin-ops-identity-patterns.html',
  qa: 'admin-qa.html'
};

function mountAdminRoutes(app) {
  const root = path.join(__dirname, '..');
  const boardPage = path.join(root, 'recruiting-board.html');
  const hubPage = path.join(root, 'admin.html');

  app.get('/admin', (req, res) => {
    res.sendFile(hubPage);
  });

  app.get('/admin/embed/:page', (req, res) => {
    const file = ADMIN_EMBED_PAGES[req.params.page];
    if (!file) return res.status(404).send('Admin embed page not found');
    return res.sendFile(path.join(root, file));
  });

  ADMIN_HUB_REDIRECTS.forEach(([from, to]) => {
    app.get(from, (req, res) => {
      res.redirect(302, to);
    });
  });

  // Recruiting board — redirect to team section in hub (embed still served for iframes)
  app.get('/recruiting-board', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    return res.redirect(302, '/admin#team/board');
  });

  app.get('/recruiting', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    return res.redirect(302, '/admin#team/board');
  });

  app.get('/recruits', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    return res.redirect(302, '/admin#team/board');
  });

  app.get('/admin/recruiting', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    return res.redirect(302, '/admin#recruiting/alerts');
  });

  app.get('/admin/recruiting-board', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    return res.redirect(302, '/admin#team/board');
  });
}

module.exports = { mountAdminRoutes, ADMIN_HUB_REDIRECTS, ADMIN_EMBED_PAGES };
