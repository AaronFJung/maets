# Maets

Maets is a turn-based gaming platform built for the Ivy Tech SDEV program.

This repository currently contains the project's development environment and initial structure. Game functionality has not been implemented yet.

## Project Structure

| Directory | Description |
| ---------- | ----------- |
| `next/` | Next.js frontend built with TypeScript and Tailwind CSS |
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