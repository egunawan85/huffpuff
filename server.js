require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const httpProxy = require('http-proxy');
const passport = require('./src/auth/passport');
const authRoutes = require('./src/auth/routes');
const requireAuth = require('./src/middleware/require-auth');
const { ensureMachine, getMachine, getMachineAddress, touchMachine } = require('./src/containers/machines');
const { startIdleMonitor } = require('./src/containers/idle-monitor');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

const app = express();
app.set('trust proxy', 1);
const proxy = httpProxy.createProxyServer({ ws: true });

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Workspace is starting up, please refresh in a moment.');
  }
});

// Session store (SQLite via connect-sqlite3)
const SQLiteStore = require('connect-sqlite3')(session);

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.db', dir: process.env.DATA_DIR || path.join(__dirname, 'data') }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

app.use(sessionMiddleware);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Auth routes (public)
app.use('/auth', authRoutes);

// Login page is public
app.get('/login.html', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Public assets needed for login page
app.use('/css/login.css', express.static(path.join(__dirname, 'public', 'css', 'login.css')));

// Everything else requires authentication
app.use((req, res, next) => {
  if (req.path === '/login.html' || req.path.startsWith('/auth/')) return next();
  requireAuth(req, res, next);
});

// User info endpoint (served by gateway, not container)
app.get('/api/me', (req, res) => {
  const { id, email, display_name, avatar_url } = req.user;
  res.json({ id, email, display_name, avatar_url });
});

// Proxy all other authenticated requests to the user's workspace machine
app.use(async (req, res) => {
  try {
    const record = await ensureMachine(req.user.id);
    const target = getMachineAddress(record);
    touchMachine(req.user.id);
    proxy.web(req, res, { target });
  } catch (err) {
    console.error(`Failed to proxy for user ${req.user.id}:`, err.message);
    res.status(503).send('Failed to start workspace. Please try again.');
  }
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Gateway server running on http://localhost:${PORT}`);
  startIdleMonitor();
});

// Handle WebSocket upgrades (for ttyd)
server.on('upgrade', (req, socket, head) => {
  // Parse session to identify the user
  sessionMiddleware(req, {}, async () => {
    passport.initialize()(req, {}, () => {
      passport.session()(req, {}, async () => {
        if (!req.user) {
          socket.destroy();
          return;
        }

        try {
          const record = getMachine(req.user.id);
          if (!record || record.status !== 'started') {
            socket.destroy();
            return;
          }
          const target = getMachineAddress(record);
          touchMachine(req.user.id);
          proxy.ws(req, socket, head, { target });
        } catch (err) {
          console.error('WebSocket proxy error:', err.message);
          socket.destroy();
        }
      });
    });
  });
});
