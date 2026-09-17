# Contributing to iptv-catalog

A TypeScript/Express API + React web UI that mirrors the iptv-org channel
catalog into SQLite, builds custom playlists, and serves them as
Channels-DVR-compatible M3U/XMLTV URLs. Contributions — new channel/EPG
features, UI improvements, bug fixes — are welcome.

## Getting started

This is a two-part project: an Express/TypeScript backend at the repo root,
and a React/Vite frontend in `frontend/`.

```
git clone https://github.com/zackwag/iptv-catalog.git
cd iptv-catalog
npm ci
npm ci --prefix frontend
```

## Development

```
npm run dev                  # backend, with auto-reload
npm run dev --prefix frontend  # frontend dev server
```

Lint and format both before submitting a PR — CI checks both:

```
npm run lint
npm run format:check
npm run lint --prefix frontend
npm run format:check --prefix frontend
```

There is currently no automated test suite in this repo — CI only lints and
format-checks.

Build for production (backend + bundles frontend into `public/`):

```
npm run build:local
```

A full local stack (this app + the iptv-org EPG sidecar) can also be run via
`docker-compose.yml`.

## Commit messages and pull requests

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.). Pull requests are squash-merged, and the **PR title** becomes the commit on `main` — so PR titles must follow this format. This is enforced automatically by the "Conventional Commits" check.

Direct pushes to `main` are allowed but must also use a Conventional Commits-formatted commit message (validated by the same check).

## Opening a pull request

1. Fork the repo and create a branch off `main`.
2. Make your changes.
3. Open a pull request with a Conventional Commits-formatted title.
4. Wait for CI to pass — required checks must be green before merge.

## Reporting issues

Use [GitHub Issues](../../issues) for bugs and feature requests.
