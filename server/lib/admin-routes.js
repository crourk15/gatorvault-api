const path = require('path');

function mountAdminRoutes(app) {
  const boardPage = path.join(__dirname, '..', 'recruiting-board.html');

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
  });

  app.get('/admin/feedback', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-feedback.html'));
  });

  app.get('/recruiting-board', (req, res) => {
    res.sendFile(boardPage);
  });

  app.get('/recruiting', (req, res) => {
    res.sendFile(boardPage);
  });

  app.get('/recruits', (req, res) => {
    res.sendFile(boardPage);
  });

  app.get('/admin/recruiting', (req, res) => {
    res.sendFile(boardPage);
  });

  app.get('/admin/recruiting-board', (req, res) => {
    res.sendFile(boardPage);
  });
}

module.exports = { mountAdminRoutes };
