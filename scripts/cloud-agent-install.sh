#!/usr/bin/env bash
#
# Cloud Agent environment bootstrap for the Kalanara voucher platform.
# Idempotent: safe to run repeatedly. Installs Bun (if missing), project
# dependencies, and a local .env.local so the Next.js dev server can boot
# without real credentials (data-layer calls fail gracefully until secrets
# are provided).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- 1. Install Bun (pinned major, idempotent) ---------------------------------
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  echo "==> Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
else
  echo "==> Bun already installed: $(bun --version)"
fi

# --- 2. Install dependencies from the lockfile ---------------------------------
echo "==> Installing dependencies (bun install)..."
bun install --frozen-lockfile

# --- 3. Ensure a local .env.local exists so the app can boot -------------------
# Real secrets injected as environment variables are preferred; placeholders are
# only used for values that are otherwise empty. This keeps the dev server
# runnable out of the box while never shadowing injected credentials.
ENV_FILE="$REPO_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creating placeholder .env.local (replace with real secrets to enable Supabase/Resend/Scalev)..."
  cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder-local.supabase.co}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.anon}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.service}
RESEND_API_KEY=${RESEND_API_KEY:-re_placeholder}
UPLOADTHING_TOKEN=${UPLOADTHING_TOKEN:-}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000}

NEXT_PUBLIC_META_PIXEL_ID=${NEXT_PUBLIC_META_PIXEL_ID:-}

NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN:-}
NEXT_PUBLIC_SENTRY_ENV=${NEXT_PUBLIC_SENTRY_ENV:-development}
SENTRY_DSN=${SENTRY_DSN:-}
SENTRY_ENV=${SENTRY_ENV:-development}
SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN:-}
SENTRY_ORG=${SENTRY_ORG:-}
SENTRY_PROJECT=${SENTRY_PROJECT:-}

SCALEV_API_KEY=${SCALEV_API_KEY:-}
SCALEV_API_BASE_URL=${SCALEV_API_BASE_URL:-https://api.scalev.id/v2}
SCALEV_STORE_UNIQUE_ID=${SCALEV_STORE_UNIQUE_ID:-store_uFfyn8rkIwuwWbHAKVYeRjOi}
SCALEV_STORE_NAME=${SCALEV_STORE_NAME:-Kalanara Spa}
SCALEV_PAYMENT_METHODS=${SCALEV_PAYMENT_METHODS:-qris,invoice,va,gopay,ovo,dana,shopeepay,linkaja}
SCALEV_VA_BANKS=${SCALEV_VA_BANKS:-BCA,BNI,BRI,MANDIRI,PERMATA,BSI,BJB,CIMB,SAHABAT_SAMPOERNA,ARTAJASA}
SCALEV_PUBLIC_BASE_URL=${SCALEV_PUBLIC_BASE_URL:-https://app.scalev.id}
SCALEV_WEBHOOK_SIGNING_SECRET=${SCALEV_WEBHOOK_SIGNING_SECRET:-}
EOF
else
  echo "==> .env.local already present, leaving it untouched."
fi

echo "==> Cloud Agent install complete."
