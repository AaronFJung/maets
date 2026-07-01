#!/usr/bin/env bash
set -euo pipefail

# volumes (see devcontainer.json) so the Linux container
#    never shares them with the Windows host. Fresh volumes are created root-owned,
#    so hand them to the 'node' user before installing. 1. node_modules (root Biome tooling), next/node_modules, and next/.next are
#    container-only Docker
sudo chown node:node node_modules next/node_modules next/.next

# 2. Install the root dev tooling (Biome, which the editor uses to format the whole
#    repo). `npm ci` does a clean, exact install from the committed package-lock.json.
npm ci

# 3. Install the Next.js app's dependencies the same way, so every teammate gets
#    identical deps.
cd ./next
npm ci
cd ..

# 4. Seed the frontend env file so the app connects out of the box.
#    -n (no-clobber) means an existing .env.local is left untouched.
cp -n next/.env.example next/.env.local 2>/dev/null || true

echo "post-create complete."
