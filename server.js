const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { createFilesRouter } = require('./src/routes/files');

const PORT = process.env.PORT || 3000;
const TTYD_PORT = process.env.TTYD_PORT || 7681;
const TTYD_CMD = process.env.TTYD_CMD || 'claude';
const FILES_ROOT = process.env.FILES_ROOT || '/root/product-plan/egunawan85';

const app = express();

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// File browser API
app.use('/api/files', createFilesRouter(FILES_ROOT));

// Config endpoint so the frontend knows where to find ttyd
app.get('/api/config', (req, res) => {
  res.json({
    ttydPort: TTYD_PORT,
    filesRoot: FILES_ROOT,
  });
});

// Start ttyd as a child process
function startTtyd() {
  const ttydBin = process.env.TTYD_BIN || 'ttyd';
  const ttyd = spawn(ttydBin, [
    '--port', String(TTYD_PORT),
    '--writable',
    TTYD_CMD,
  ], { stdio: 'inherit' });

  ttyd.on('error', (err) => {
    console.error(`Failed to start ttyd: ${err.message}`);
    console.error('Install ttyd or set TTYD_BIN to the correct path');
  });

  ttyd.on('exit', (code) => {
    console.error(`ttyd exited with code ${code}, restarting in 2s...`);
    setTimeout(startTtyd, 2000);
  });

  return ttyd;
}

app.listen(PORT, () => {
  console.log(`Workspace server running on http://localhost:${PORT}`);
  startTtyd();
});
