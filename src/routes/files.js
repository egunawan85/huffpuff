const express = require('express');
const fs = require('fs');
const path = require('path');
const { createPathValidator } = require('../middleware/safe-path');

function createFilesRouter(filesRoot) {
  const router = express.Router();
  const safePath = createPathValidator(filesRoot);

  // SSE clients for file-watch notifications
  const watchClients = new Set();

  function notifyClients() {
    for (const res of watchClients) {
      res.write('data: change\n\n');
    }
  }

  // Watch filesystem for changes
  fs.watch(filesRoot, { recursive: true }, () => notifyClients());

  // List directory
  router.get('/list', (req, res) => {
    const dir = safePath(req.query.dir || filesRoot);
    if (!dir) return res.status(403).json({ error: 'Forbidden' });

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      const entries = items.map(e => {
        const full = path.join(dir, e.name);
        const stat = fs.statSync(full);
        return {
          name: e.name,
          path: full,
          isDir: e.isDirectory(),
          size: e.isDirectory() ? null : stat.size,
          modified: stat.mtime,
        };
      });

      res.json(entries);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Read file contents
  router.get('/read', (req, res) => {
    const file = safePath(req.query.file);
    if (!file) return res.status(403).json({ error: 'Forbidden' });

    try {
      const content = fs.readFileSync(file, 'utf-8');
      res.type('text/plain').send(content);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Download file
  router.get('/download', (req, res) => {
    const file = safePath(req.query.file);
    if (!file) return res.status(403).json({ error: 'Forbidden' });

    try {
      const stat = fs.statSync(file);
      const filename = path.basename(file);
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stat.size,
      });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Create file or folder
  router.post('/create', express.json(), (req, res) => {
    const { parentDir, name, isDir } = req.body;
    const target = safePath(path.join(parentDir, name));
    if (!target) return res.status(403).json({ error: 'Forbidden' });
    if (fs.existsSync(target)) return res.status(409).json({ error: 'Already exists' });

    try {
      if (isDir) {
        fs.mkdirSync(target, { recursive: true });
      } else {
        fs.writeFileSync(target, '');
      }
      res.status(201).json({ ok: true, path: target });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Move (drag & drop)
  router.post('/move', express.json(), (req, res) => {
    const { srcPath, destDir } = req.body;
    const src = safePath(srcPath);
    if (!src) return res.status(403).json({ error: 'Forbidden' });

    const dest = safePath(path.join(destDir, path.basename(src)));
    if (!dest) return res.status(403).json({ error: 'Forbidden' });
    if (src === dest) return res.json({ ok: true, path: dest });
    if (dest.startsWith(src + '/')) return res.status(400).json({ error: 'Cannot move into itself' });
    if (fs.existsSync(dest)) return res.status(409).json({ error: 'Already exists at destination' });

    try {
      fs.renameSync(src, dest);
      res.json({ ok: true, path: dest });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Rename
  router.post('/rename', express.json(), (req, res) => {
    const { oldPath, newName } = req.body;
    const old = safePath(oldPath);
    if (!old) return res.status(403).json({ error: 'Forbidden' });

    const newPath = safePath(path.join(path.dirname(old), newName));
    if (!newPath) return res.status(403).json({ error: 'Forbidden' });

    try {
      fs.renameSync(old, newPath);
      res.json({ ok: true, path: newPath });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Delete
  router.post('/delete', express.json(), (req, res) => {
    const { targetPath } = req.body;
    const target = safePath(targetPath);
    if (!target) return res.status(403).json({ error: 'Forbidden' });
    if (target === path.resolve(filesRoot)) return res.status(403).json({ error: 'Cannot delete root' });

    try {
      fs.rmSync(target, { recursive: true, force: true });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Upload
  router.post('/upload', (req, res) => {
    const destDir = safePath(req.query.dir || filesRoot);
    if (!destDir) return res.status(403).json({ error: 'Forbidden' });

    const filename = decodeURIComponent(req.query.name || 'upload');
    let destPath = path.join(destDir, path.basename(filename));
    if (!safePath(destPath)) return res.status(403).json({ error: 'Forbidden' });

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        fs.mkdirSync(destDir, { recursive: true });

        // Auto-rename duplicates: file.txt -> file (1).txt
        if (fs.existsSync(destPath)) {
          const ext = path.extname(destPath);
          const base = destPath.slice(0, destPath.length - ext.length);
          let n = 1;
          while (fs.existsSync(destPath)) {
            destPath = `${base} (${n})${ext}`;
            n++;
          }
        }

        fs.writeFileSync(destPath, Buffer.concat(chunks));
        res.json({ ok: true, path: destPath });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  });

  // SSE watch for filesystem changes
  router.get('/watch', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: connected\n\n');
    watchClients.add(res);
    req.on('close', () => watchClients.delete(res));
  });

  return router;
}

module.exports = { createFilesRouter };
