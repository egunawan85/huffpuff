# PIG Workspace (huffpuff)

Web-based IDE workspace combining a file browser/editor with a web terminal (ttyd).

## Stack
- **Backend**: Node.js + Express 4
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Terminal**: ttyd (spawned as child process)

## Architecture
Two deployments on Fly.io:
- **Gateway** (`server.js`) — auth, session, proxies to per-user workspace machines
- **Workspace** (`workspace/server.js`) — runs inside each user's container, serves file API + ttyd

## Project Structure
```
server.js                      # Gateway server (auth + proxy)
Dockerfile.gateway             # Gateway container build
fly.gateway.toml               # Gateway Fly.io config

workspace/                     # Workspace container code
  server.js                    # Workspace Express server (ttyd + file API)
  package.json                 # Workspace-only dependencies
  entrypoint.sh                # Container startup script
Dockerfile.workspace           # Workspace container build
fly.workspace.toml             # Workspace Fly.io config

src/                           # Shared and gateway source
  auth/passport.js             # Google OAuth strategy
  auth/routes.js               # OAuth endpoints
  db/index.js                  # SQLite (users, machines tables)
  containers/machines.js       # Fly Machines API client
  containers/idle-monitor.js   # Auto-stop idle workspaces
  middleware/require-auth.js   # Auth guard (gateway-only)
  middleware/safe-path.js      # Path traversal protection (used by workspace)
  routes/files.js              # File API routes (used by workspace)

public/                        # Single set of frontend assets (served by workspace)
  login.html                   # Login page (served by gateway)
  index.html                   # Main workspace (2-panel: terminal + file browser)
  file-browser.html            # File browser iframe
  js/workspace.js              # Workspace controller
  js/file-browser.js           # File browser logic
  css/                         # Styles

deploy.sh                      # One-command deploy (builds both, sets secrets, DNS)
```

## Commands
- `npm start` — Run gateway server (`node server.js`)
- `npm run dev` — Run gateway with watch mode (`node --watch server.js`)
- `npm install` — Install gateway dependencies
- `bash deploy.sh` — Deploy everything to Fly.io

## Environment Variables (see .env.example)
### Gateway
- `PORT` — Express server port (default: 3000)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth credentials
- `SESSION_SECRET` — Session encryption key
- `FLY_API_TOKEN` — Fly.io API token for machine management
- `WORKSPACE_APP_NAME` — Workspace app name on Fly.io (not `FLY_APP_NAME` — Fly injects that automatically)
- `WORKSPACE_IMAGE` — Workspace container image reference
- `FLY_REGION` — Fly.io region (default: sjc)
- `IDLE_TIMEOUT_MINUTES` — Stop workspace after N minutes idle (default: 30)

### Workspace Container
- `PORT` — Express server port (default: 3000)
- `TTYD_PORT` — Terminal port (default: 7681)
- `TTYD_CMD` — Command to run in terminal (default: claude)
- `FILES_ROOT` — File browser root directory
- `TTYD_BIN` — Path to ttyd binary
