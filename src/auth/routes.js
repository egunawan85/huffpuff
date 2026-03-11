const express = require('express');
const passport = require('passport');
const { ensureMachine } = require('../containers/machines');
const router = express.Router();

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Google OAuth callback — start workspace eagerly
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  async (req, res) => {
    try {
      await ensureMachine(req.user.id);
    } catch (err) {
      console.error('Failed to provision workspace on login:', err.message);
    }
    req.session.save(() => {
      res.redirect('/');
    });
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login.html');
  });
});

module.exports = router;
