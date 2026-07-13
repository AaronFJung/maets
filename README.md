# Maets


![Maets is a turn-based gaming platform built for the Ivy Tech SDEV program.](next\public\banner.png)

This repository currently contains the project's development environment and initial structure. Game functionality has not been implemented yet.

## Project Structure

| Directory | Description |
| ---------- | ----------- |
| `next/` | Next.js frontend built with TypeScript, Tailwind CSS, and shadcn/ui |
| `supabase/` | Local Supabase backend (Postgres, Auth, Realtime, and migrations) |
| `.devcontainer/` | Development container configuration |

## Getting Started

### Prerequisites

- Docker Desktop
- Visual Studio Code
- Dev Containers extension

### Setup

1. Clone the repository.
2. Open it in VS Code.
3. Run **Dev Containers: Reopen in Container**.

The container starts Supabase and the Next.js dev server for you and opens the app and Supabase Studio in your browser. The first build takes a few minutes while Docker pulls the Supabase images.

> Run all `npm` commands from inside the development container, and use the **Run Task** menu (`Terminal → Run Task`) to start or stop services manually.

## Development

### Local Services

| Service | URL |
| ------- | --- |
| Frontend | http://localhost:3000 |
| Supabase API | http://localhost:54321 |
| Supabase Studio | http://localhost:54323 |

Supabase Studio provides a web interface for viewing the local database, authentication users, and other Supabase resources.

## Releasing

Maets uses trunk-based development: everything is committed directly to `main`. A
**release** is just a git tag on a specific commit, plus a GitHub Release with notes — it
doesn't change how you work day to day.

The version lives in the **repo-root** `package.json`, not `next/package.json`, because a
release can include changes anywhere in the repo (the Next app, `supabase/` migrations,
etc.), not just the frontend.

We're pre-1.0 and still iterating through features, so every release right now is a
pre-release (`-alpha`, `-beta`, `-rc`) working toward the first `0.1.0`. Nothing is tagged
`latest`/stable yet.

### Cutting a release

Run one of these from the repo root. Each one lints, bumps the version, commits, tags, and
pushes automatically (`git push --follow-tags`) — a GitHub Actions workflow then publishes
the matching GitHub Release.

| Command | Effect | Example |
| --- | --- | --- |
| `npm run release:preminor` | Start the alpha cycle for the next minor | `0.0.0` → `0.1.0-alpha.0` |
| `npm run release:alpha` | Next alpha build | `0.1.0-alpha.0` → `0.1.0-alpha.1` |
| `npm run release:beta` | Move to / next beta build | `0.1.0-alpha.3` → `0.1.0-beta.0` |
| `npm run release:rc` | Move to / next release candidate | `0.1.0-beta.1` → `0.1.0-rc.0` |
| `npm run release:finalize` | Drop the prerelease suffix (first stable milestone) | `0.1.0-rc.1` → `0.1.0` |

The very first release you cut should be `npm run release:preminor`, which produces
`v0.1.0-alpha.0`.

> **Note:** because every release right now is a pre-release, GitHub's "latest release" API
> (and `gh release view` with no arguments) won't return it — pre-releases are excluded by
> design. Anything that needs "the newest release" should list releases
> (`gh release list`) and take the top entry instead.