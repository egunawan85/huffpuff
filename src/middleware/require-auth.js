function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();

  // API requests get 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Page requests redirect to login
  res.redirect('/login.html');
}

module.exports = requireAuth;
