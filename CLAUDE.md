# PIG Workspace (huffpuff)

Web-based IDE workspace combining a file browser/editor with a web terminal (ttyd).

## Stack
- **Backend**: Node.js + Express 4
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Terminal**: ttyd (spawned as child process)

## Project Structure
```
server.js                  # Main Express server, spawns ttyd
src/routes/files.js        # File API routes (list, read, create, move, rename, delete, upload, watch)
src/middleware/safe-path.js # Path traversal protection
public/                    # Static frontend assets
  index.html               # Main workspace (2-panel: terminal + file browser)
  file-browser.html        # File browser iframe
  js/workspace.js          # Workspace controller
  js/file-browser.js       # File browser logic
  css/                     # Styles
```

## Commands
- `npm start` — Run server (`node server.js`)
- `npm run dev` — Run with watch mode (`node --watch server.js`)
- `npm install` — Install dependencies

## Environment Variables (see .env.example)
- `PORT` — Express server port (default: 3000)
- `TTYD_PORT` — Terminal port (default: 7681)
- `TTYD_CMD` — Command to run in terminal (default: claude)
- `FILES_ROOT` — File browser root directory
- `TTYD_BIN` — Path to ttyd binary
