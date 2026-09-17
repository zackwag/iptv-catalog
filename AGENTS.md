# AGENTS.md

## Project overview

iptv-catalog is a TypeScript/Express backend + React/Vite frontend that
mirrors the iptv-org channel catalog into SQLite, lets users build custom
channel playlists, tests them for reachability on a schedule, and serves
each as a stable per-GUID M3U + XMLTV URL for Channels DVR/VLC. Ships as a
single Docker image (Express serves the API, the built frontend, and the
playlist URLs) alongside an `iptv-org/epg` sidecar container.

## Setup

```
npm ci
npm ci --prefix frontend
```

## Build / Run

```
npm run dev                    # backend dev server (ts-node-dev, auto-reload)
npm run dev --prefix frontend    # frontend dev server (Vite)
npm run build:local              # tsc build + frontend build, copied into public/
npm start                        # run the built backend (dist/index.js)
```

Docker: `docker-compose.yml` runs the full stack (this app + the iptv-org
EPG sidecar) locally.

## Test

No automated test suite exists in this repo. CI (`.github/workflows/lint.yml`)
only lints and format-checks; do not invent a test command.

## Lint / Format

```
npm run lint              # backend (eslint src/)
npm run format:check      # backend (prettier)
npm run lint --prefix frontend
npm run format:check --prefix frontend
```
`lint-staged` + `husky` auto-run these on commit locally (skipped in CI).

## Repository structure

- `src/` — backend: `index.ts` entry, `routes/` (Express routes per
  resource: channels, playlists, backup, VPN endpoints, etc.),
  `services/` (catalog sync, EPG generation/scheduling, playlist/M3U
  building, feed testing), `db.ts` (SQLite), `middleware/`
- `frontend/src/` — React app: `pages/`, `components/`, `api.ts` (backend
  client)
- `scripts/` — maintenance/build scripts

## Commit and PR conventions

- Commit messages and PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `build:`, `perf:`, `style:`, `revert:`), optionally with a scope, e.g. `fix(api): handle null response`.
- This repo squash-merges pull requests only; the PR title becomes the final commit message on `main`.
- A "Conventional Commits" CI check enforces this on both PR titles and direct-push commit messages.
- Branch protection on `main`: no force-pushes, no branch deletion, required status checks must pass.
