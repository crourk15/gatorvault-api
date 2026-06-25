const path = require('path');
const fs = require('fs');

/** Legacy admin URLs → unified hub hash routes */
const ADMIN_HUB_REDIRECTS = [
  ['/admin/feedback', '/admin/hub#feedback'],
  ['/admin/monitoring', '/admin/hub#recruiting/monitoring'],
  ['/admin/ops', '/admin/hub#dashboard'],
  ['/admin/ops/gm2', '/admin/hub#gm2/integrity'],
  ['/admin/ops/identity-patterns', '/admin/hub#gm2/identity'],
  ['/vault/ops', '/admin/hub#dashboard'],
  ['/recruiting-admin.html', '/admin/hub#recruiting/alerts'],
  ['/content-admin.html', '/admin/hub#content/content-accuracy'],
  ['/community-admin.html', '/admin/hub#community/moderation'],
  ['/war-room-admin.html', '/admin/hub#team/board'],
  ['/admin-feedback.html', '/admin/hub#feedback/inbox'],
  ['/admin-monitoring.html', '/admin/hub#recruiting/monitoring'],
  ['/admin-ops.html', '/admin/hub#dashboard/overview'],
  ['/admin-ops-gm2.html', '/admin/hub#gm2/integrity'],
  ['/admin-ops-identity-patterns.html', '/admin/hub#gm2/identity']
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
  gm2: 'admin-ops-gm2.html',
  identity: 'admin-ops-identity-patterns.html',
  qa: 'admin-qa.html',
  'qa-mobile': 'admin-qa-mobile.html',
  'product-intel': 'admin-product-intel.html',
  'self-runner': 'admin-self-runner.html'
};

function mountAdminRoutes(app) {
  const root = path.join(__dirname, '..');
  const boardPage = path.join(root, 'recruiting-board.html');
  const boardPublic = path.join(root, 'recruiting-board', 'index.html');
  const hubPage = path.join(root, 'admin.html');

  const loginPage = path.join(root, 'admin-login.html');

  app.get('/admin', (req, res) => {
    res.sendFile(hubPage);
  });

  app.get('/admin/hub', (req, res) => {
    res.sendFile(hubPage);
  });

  app.get('/admin/login', (req, res) => {
    res.sendFile(loginPage);
  });

  app.get('/admin/embed/:page', (req, res) => {
    const file = ADMIN_EMBED_PAGES[req.params.page];
    if (!file) return res.status(404).send('Admin embed page not found');
    return res.sendFile(path.join(root, file));
  });

  app.get('/admin-qa.html', (req, res) => {
    res.sendFile(path.join(root, 'admin-qa.html'));
  });

  app.get('/admin-qa-mobile.html', (req, res) => {
    res.sendFile(path.join(root, 'admin-qa-mobile.html'));
  });

  app.get('/admin-self-runner.html', (req, res) => {
    res.sendFile(path.join(root, 'admin-self-runner.html'));
  });

  app.get('/admin-product-intel.html', (req, res) => {
    res.sendFile(path.join(root, 'admin-product-intel.html'));
  });

  ADMIN_HUB_REDIRECTS.forEach(([from, to]) => {
    app.get(from, (req, res) => {
      res.redirect(302, to);
    });
  });

  // Recruiting board — public React UI on Netlify; admin embed only with ?embed=1
  app.get('/recruiting-board', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    if (fs.existsSync(boardPublic)) return res.sendFile(boardPublic);
    const site = process.env.SITE_URL || 'https://gatorvaultinsider.com';
    return res.redirect(302, `${site.replace(/\/$/, '')}/recruiting-board`);
  });

  app.get('/recruiting-board.html', (req, res) => {
    return res.sendFile(boardPage);
  });

  app.get('/recruiting', (req, res) => {
    return res.redirect(302, '/recruiting-board');
  });

  app.get('/recruits', (req, res) => {
    return res.redirect(302, '/recruiting-board');
  });

  app.get('/admin/recruiting', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(path.join(root, 'recruiting-admin.html'));
    return res.redirect(302, '/admin/hub#recruiting/alerts');
  });

  app.get('/admin/recruiting-board', (req, res) => {
    if (req.query.embed === '1') return res.sendFile(boardPage);
    return res.redirect(302, '/admin/hub#team/board');
  });
}

module.exports = { mountAdminRoutes, ADMIN_HUB_REDIRECTS, ADMIN_EMBED_PAGES };
