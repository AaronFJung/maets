#!/usr/bin/env bash
set -euo pipefail

# Start the local Supabase stack (blocks until healthy, then returns).
# Studio: http://localhost:54323  API: http://localhost:54321
supabase start

# Auto-open Supabase Studio. Its port is published by docker-in-docker, so
# VS Code's onAutoForward:openBrowser doesn't reliably fire for it the way it
# does for the Next.js process. $BROWSER is a helper VS Code injects inside dev
# containers that opens the URL on the host; fall back to a no-op if unset.
"${BROWSER:-true}" http://localhost:54323 >/dev/null 2>&1 || true

# Start the Next.js dev server in the foreground so its logs stream here.
# App: http://localhost:3000  (VS Code auto-forwards + opens it)
cd next
npm run dev
