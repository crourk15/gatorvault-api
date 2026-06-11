module.exports = (app) => {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });
};
