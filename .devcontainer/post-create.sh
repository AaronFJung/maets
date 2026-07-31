#!/usr/bin/env bash
set -euo pipefail

# 1. node_modules and next/.next are container-only Docker volumes (see
#    devcontainer.json) so the Linux container never shares them with the
#    Windows host. Fresh volumes are created root-owned, so hand them to the
#    'node' user before installing.
sudo chown node:node node_modules next/.next

# 2. Install every workspace in one pass. `npm ci` does a clean, exact install
#    from the committed package-lock.json.
npm ci

# 3. Seed the frontend env file so the app connects out of the box.
#    -n (no-clobber) means an existing .env.local is left untouched.
cp -n next/.env.example next/.env.local 2>/dev/null || true

echo "post-create complete."
