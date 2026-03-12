#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# Load .env for secrets
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

GATEWAY_APP="${GATEWAY_APP:-huffpuff-gateway}"
WORKSPACES_APP="${FLY_APP_NAME:-huffpuff-workspaces}"
REGION="${FLY_REGION:-sjc}"
DOMAIN="${DOMAIN:-thehuffandpuff.com}"

# ── 1. Install flyctl if missing ─────────────────────────────────────
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

if ! command -v flyctl &>/dev/null; then
  echo "==> Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
fi

# Check auth
if ! flyctl auth whoami &>/dev/null; then
  echo "==> Not logged in to Fly.io. Authenticating..."
  echo "    A browser link will appear — open it to log in."
  echo ""
  flyctl auth login
fi

echo "==> Logged in as: $(flyctl auth whoami)"
echo ""

# ── 2. Create Fly apps (idempotent) ──────────────────────────────────
for app in "$GATEWAY_APP" "$WORKSPACES_APP"; do
  if flyctl apps list --json | grep -q "\"$app\""; then
    echo "==> App '$app' already exists"
  else
    echo "==> Creating app '$app' in region $REGION..."
    flyctl apps create "$app" --org personal
  fi
done
echo ""

# ── 3. Build and push workspace container image ──────────────────────
echo "==> Building workspace container image..."
BUILD_OUTPUT=$(flyctl deploy --app "$WORKSPACES_APP" --config fly.workspace.toml --build-only --push --remote-only 2>&1)
echo "$BUILD_OUTPUT"
# Extract the image reference (with sha256 digest) from the build output
FLY_WS_IMAGE=$(echo "$BUILD_OUTPUT" | grep -o 'registry.fly.io/'"$WORKSPACES_APP"'[^ ]*@sha256:[a-f0-9]*' | head -1)
if [ -z "$FLY_WS_IMAGE" ]; then
  echo "WARNING: Could not extract image digest, falling back to :latest tag"
  FLY_WS_IMAGE="registry.fly.io/$WORKSPACES_APP:latest"
fi
echo "    Image: $FLY_WS_IMAGE"
echo ""

# ── 4. Set gateway secrets ────────────────────────────────────────────
echo "==> Setting gateway secrets..."

# Get a Fly API token for machine management (needs org-level access to create machines/volumes)
FLY_API_TOKEN="${FLY_API_TOKEN:-}"
if [ -z "$FLY_API_TOKEN" ]; then
  echo "    Generating Fly API token (org-level for machine management)..."
  FLY_API_TOKEN=$(flyctl tokens create org --org personal -x 999999h 2>/dev/null || flyctl auth token)
fi

flyctl secrets set --app "$GATEWAY_APP" --stage \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  CALLBACK_URL="${CALLBACK_URL:-https://$DOMAIN/auth/google/callback}" \
  SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}" \
  FLY_API_TOKEN="$FLY_API_TOKEN" \
  WORKSPACE_APP_NAME="$WORKSPACES_APP" \
  WORKSPACE_IMAGE="$FLY_WS_IMAGE" \
  FLY_REGION="$REGION" \
  IDLE_TIMEOUT_MINUTES="${IDLE_TIMEOUT_MINUTES:-30}" \
  COOKIE_SECURE="true"

echo "    Secrets staged."
echo ""

# ── 5. Deploy gateway ────────────────────────────────────────────────
echo "==> Deploying gateway..."
flyctl deploy --app "$GATEWAY_APP" --config fly.gateway.toml --ha=false --remote-only
echo ""

# ── 6. Set up custom domain (if not already) ─────────────────────────
if ! flyctl certs list --app "$GATEWAY_APP" --json 2>/dev/null | grep -q "$DOMAIN"; then
  echo "==> Adding custom domain $DOMAIN..."
  flyctl certs create --app "$GATEWAY_APP" "$DOMAIN" || true
  echo ""
  echo "    !! Point your DNS for $DOMAIN to the Fly.io app:"
  echo "    CNAME $DOMAIN -> $GATEWAY_APP.fly.dev"
  echo "    (or use an A record — run 'flyctl ips list --app $GATEWAY_APP' for the IP)"
  echo ""
else
  echo "==> Custom domain $DOMAIN already configured"
fi
echo ""

# ── 7. Allocate shared IPv4 if needed ─────────────────────────────────
if ! flyctl ips list --app "$GATEWAY_APP" --json 2>/dev/null | grep -q '"v4"'; then
  echo "==> Allocating shared IPv4..."
  flyctl ips allocate-v4 --shared --app "$GATEWAY_APP" || true
fi
echo ""

# ── Done ──────────────────────────────────────────────────────────────
GATEWAY_URL=$(flyctl ips list --app "$GATEWAY_APP" --json 2>/dev/null | grep -o '"address":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

echo "============================================"
echo " Huffpuff deployed!"
echo "============================================"
echo ""
echo "  Gateway:      https://$GATEWAY_APP.fly.dev"
echo "  Custom domain: https://$DOMAIN"
echo "  Dashboard:    https://fly.io/apps/$GATEWAY_APP"
echo ""
echo "  Logs:         flyctl logs --app $GATEWAY_APP"
echo "  Workspace logs: flyctl logs --app $WORKSPACES_APP"
echo "  Restart:      flyctl machines restart --app $GATEWAY_APP"
echo ""
echo "  DNS: Point $DOMAIN CNAME -> $GATEWAY_APP.fly.dev"
if [ -n "${GATEWAY_URL:-}" ]; then
  echo "  (or A record -> $GATEWAY_URL)"
fi
echo ""
