const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createFilesRouter } = require('./src/routes/files');

const PORT = process.env.PORT || 3000;
const TTYD_PORT = process.env.TTYD_PORT || 7681;
const TTYD_CMD = process.env.TTYD_CMD || 'claude';
const FILES_ROOT = process.env.FILES_ROOT || '/home/user/workspace';

const app = express();

// Proxy /ttyd/ to local ttyd process
app.use('/ttyd/', createProxyMiddleware({
  target: `http://127.0.0.1:${TTYD_PORT}`,
  ws: true,
  changeOrigin: true,
  pathRewrite: { '^/ttyd/': '/' },
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// File browser API
app.use('/api/files', createFilesRouter(FILES_ROOT));

// Start ttyd
function startTtyd() {
  const ttydBin = process.env.TTYD_BIN || 'ttyd';
  const env = { ...process.env };
  delete env.CLAUDE_CONTEXT;

  const ttyd = spawn(ttydBin, [
    '--port', String(TTYD_PORT),
    '--writable',
    TTYD_CMD,
  ], { stdio: 'inherit', cwd: FILES_ROOT, env });

  ttyd.on('error', (err) => {
    console.error(`Failed to start ttyd: ${err.message}`);
  });

  ttyd.on('exit', (code) => {
    console.error(`ttyd exited with code ${code}, restarting in 2s...`);
    setTimeout(startTtyd, 2000);
  });

  return ttyd;
}

const server = app.listen(PORT, () => {
  console.log(`Workspace container running on port ${PORT}`);
  startTtyd();
});

// Handle WebSocket upgrade for ttyd proxy
server.on('upgrade', (req, socket, head) => {
  // http-proxy-middleware handles this automatically via the ws: true option
});
