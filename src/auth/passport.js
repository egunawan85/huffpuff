const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user || false);
});

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('WARNING: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set. Google OAuth disabled.');
} else {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || '/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails && profile.emails[0] && profile.emails[0].value;
  const avatar = profile.photos && profile.photos[0] && profile.photos[0].value;

  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);

  if (user) {
    // Update profile info on each login
    db.prepare('UPDATE users SET display_name = ?, avatar_url = ?, email = ? WHERE id = ?')
      .run(profile.displayName, avatar, email, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  } else {
    const result = db.prepare(
      'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)'
    ).run(profile.id, email, profile.displayName, avatar);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  done(null, user);
  }));
}

module.exports = passport;
