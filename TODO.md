# TODO

## Phase 1: Authentication [DONE]
- Google OAuth login via passport-google-oauth20
- SQLite session store
- Login page with redirect

## Phase 2: Per-User Isolation via Fly.io

### Architecture
- **Gateway server** (always-on Fly Machine) — Express app handling auth, session, container lifecycle
- **Per-user workspace machines** — one Fly Machine per user, scale-to-zero on idle
- **Fly Volumes** — persistent storage per user (1-3GB each)

### Docker Image (Workspace)
- Base: node:20-slim
- Includes: git, python3, pip, ttyd, claude CLI, common tools
- Runs a lightweight Express server (no auth) serving file API + proxying /ttyd/
- npm/pip installs in workspace dir persist via volume
- System-level (apt) installs do not persist (acceptable tradeoff)

### Gateway Server (Transform current server.js)
- Keep: auth, sessions, passport, login page
- Remove: ttyd spawning, file serving, file API
- Add: Fly Machines API client to create/start/stop user machines
- Add: http-proxy to forward authenticated requests to user's machine
- Add: WebSocket upgrade handling for ttyd proxy
- Add: idle detection — stop machines after N minutes of inactivity

### Database Changes
- Add `machines` table: user_id, machine_id, volume_id, status, last_active_at

### Deploy Flow
- Gateway deployed as always-on Fly Machine
- On user first login: create Fly Machine + Volume, store in DB
- On subsequent login: start existing machine if stopped
- On idle timeout: stop machine (volume persists)

### Fly.io Resources
- 1 Gateway: shared-cpu-1x, 256MB (always-on)
- Per-user: shared-cpu-1x, 256-512MB (scale-to-zero)
- Per-user volume: 1-3GB
- 1 shared IPv4
- Estimated cost: ~$6-9/mo for 1-5 casual users

### Security
- Machines isolated by default on Fly.io (Firecracker microVMs)
- No direct machine-to-machine access
- ANTHROPIC_API_KEY passed as env var per machine
- Gateway is the only public entry point

## Phase 3: Sharing Between Users (Future)
- User clicks "Share" in the UI on a file/folder
- Server copies to shared storage, generates a link with permissions (view/download/edit)
- Recipient accesses via link or sees it in a "Shared with me" section
- Supports: permission control, audit trail, revocation, expiration
- All sharing goes through the gateway API
