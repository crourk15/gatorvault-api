const path = require('path');

function mountAdminRoutes(app) {
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
  });

  app.get('/admin/feedback', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-feedback.html'));
  });
}

module.exports = { mountAdminRoutes };
