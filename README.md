<p align="center">
  <img src="next/public/maets-logo.png" alt="Maets" width="400">
</p>

Maets is a browser-based platform for real-time, turn-based multiplayer games, built
for the Ivy Tech SDEV program. You register an account, host a match to get a
4-character lobby code, and share that code with a friend who joins from their own
device. The first game is Tic Tac Toe, but the match protocol underneath is
game-agnostic, so new games can be added without touching the platform itself.

**The production site is live at [maets.aaronjung.me](https://maets.aaronjung.me).**
If you just want to play, start there. The rest of this README covers running the
project locally.

What's in the box right now:

- Account registration, login, and profiles via Supabase Auth
- Host or join a match with a 4-character lobby code
- Real-time two-player Tic Tac Toe with turn enforcement and win/draw detection
- Disconnect handling: live presence, pause on disconnect, seat reclaim, and snapshot recovery on refresh
- Instant rematch in the same room
- Works on everything from desktop down to a phone

## Project Structure

| Directory | Description |
| ---------- | ----------- |
| `next/` | Next.js frontend built with TypeScript, Tailwind CSS, and shadcn/ui |
| `maets-game-sync/` | `@maets/game-sync`, the turn-based match protocol and its runtime ([spec](maets-game-sync/README.md)) |
| `maets-games/` | `@maets/games`, the game plugins (pure rules, no UI) and the registry that indexes them |
| `supabase/` | Local Supabase backend (Postgres, Auth, Realtime, and migrations) |
| `.devcontainer/` | Development container configuration |
| `docs/` | Project documents (updated project plan, testing evidence, presentation guide) |

The three code folders are [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces),
so a single `npm ci` at the repo root installs everything.

## Getting Started

There are two ways to run Maets locally: a dev container that sets everything up for
you, or a manual setup if you'd rather not use VS Code.

### Option A: Dev Container (recommended)

You'll need Docker Desktop, VS Code, and the Dev Containers extension.

1. Clone the repository.
2. Open it in VS Code.
3. Run **Dev Containers: Reopen in Container**.

The container installs dependencies, starts Supabase and the Next.js dev server, and
opens the app and Supabase Studio in your browser. The first build takes a few minutes
while Docker pulls the Supabase images.

Run all `npm` commands from inside the container, and use the **Run Task** menu
(`Terminal → Run Task`) to start or stop services manually.

### Option B: Manual setup

You'll need Node.js 22+ and Docker Desktop (Supabase runs its services in Docker).

From the repository root:

```sh
# 1. Install all workspace dependencies (exact versions from package-lock.json)
npm ci

# 2. Start the local Supabase stack (Postgres, Auth, Realtime).
#    First run downloads images and applies the migrations in supabase/migrations.
npx supabase start

# 3. Give the frontend its connection settings. The keys in .env.example are the
#    standard local-only Supabase demo keys, so they're fine to use as-is.
cp next/.env.example next/.env.local

# 4. Start the dev server
npm run dev
```

Then open http://localhost:3000. To try multiplayer on one machine, open a second
browser window (or an incognito window) and join with the lobby code shown by the
host.

If `supabase start` prints API keys that differ from `.env.example`, paste the printed
`anon` key into `next/.env.local`. To re-apply migrations to a running stack, run
`npx supabase db reset`.

### Production build

```sh
npm run build   # builds the Next.js app (requires the env vars above)
npm run start   # serves the production build on http://localhost:3000
```

## Development

### Local Services

| Service | URL |
| ------- | --- |
| Frontend | http://localhost:3000 |
| Supabase API | http://localhost:54321 |
| Supabase Studio | http://localhost:54323 |

Supabase Studio is a web interface for poking at the local database, auth users, and
other Supabase resources.

### Quality checks

```sh
npm run typecheck   # TypeScript across all three workspaces
npm run lint        # Biome lint
npm run format      # Biome format (writes changes)
```

The same checks run in CI on every push (see `.github/workflows/ci.yml`).

## Releasing

Maets uses trunk-based development: everything is committed directly to `main`. A
release is just a git tag on a specific commit plus a GitHub Release with notes.

The version lives in the repo-root `package.json` rather than `next/package.json`,
because a release can include changes anywhere in the repo (migrations in `supabase/`,
the protocol packages, and so on), not just the frontend.

We're pre-1.0 and still iterating, so every release right now is a pre-release
(`-alpha`, `-beta`, `-rc`) working toward the first `0.1.0`. Nothing is tagged
`latest`/stable yet.

### Cutting a release

Run one of these from the repo root. Each one lints, bumps the version, commits, tags,
and pushes (`git push --follow-tags`), and a GitHub Actions workflow then publishes the
matching GitHub Release.

| Command | Effect | Example |
| --- | --- | --- |
| `npm run release:preminor` | Start the alpha cycle for the next minor | `0.0.0` → `0.1.0-alpha.0` |
| `npm run release:alpha` | Next alpha build | `0.1.0-alpha.0` → `0.1.0-alpha.1` |
| `npm run release:beta` | Move to / next beta build | `0.1.0-alpha.3` → `0.1.0-beta.0` |
| `npm run release:rc` | Move to / next release candidate | `0.1.0-beta.1` → `0.1.0-rc.0` |
| `npm run release:finalize` | Drop the prerelease suffix (first stable milestone) | `0.1.0-rc.1` → `0.1.0` |

The very first release should be `npm run release:preminor`, which produces
`v0.1.0-alpha.0`.

One gotcha: because every release right now is a pre-release, GitHub's "latest
release" API (and `gh release view` with no arguments) won't return it, since
pre-releases are excluded by design. Anything that needs the newest release should
list releases (`gh release list`) and take the top entry instead.
