# Repository Guidelines

## Project Structure & Module Organization

- **`src/collect.cjs`** — Main entry point that orchestrates multi-source data collection and snapshot writing.
- **`src/collectors/`** — Per-platform collectors (`claude.cjs`, `codex.cjs`, `deepseek.cjs`, `kimi.cjs`), each responsible for one AI service.
- **`src/lib/`** — Shared utilities: config parsing (`config.cjs`), common helpers (`common.cjs`).
- **`web/`** — Kindle frontend: `index.html`, `app.js`, `style.css`, and `dashboard-runtime.js`.
- **`scripts/`** — Build, dev-server, public-safety check, and Kindle packaging scripts.
- **`tests/`** — Test files matching `src/` modules.
- **`config/`** — Runtime config directory (gitignored; only `.gitignore` checked in).
- **`state/`** — Output directory for snapshots (`data.json` / `data.js`), never committed.
- **`kindle/`** — KUAL extension packaging for jailbroken Kindle devices.

## Build, Test, and Development Commands

| Command | Purpose |
|---|---|
| `npm run demo` | Generate demo snapshot data into `state/` for local preview. |
| `npm run collect` | Collect real quota data from all enabled AI providers. |
| `npm run build` | Merge `web/` frontend + `state/` data into `dist/` for deployment. |
| `npm run serve` | Start local preview at `http://127.0.0.1:8787` (requires demo + build first). |
| `npm test` | Run all tests (`node --test tests/*.test.cjs`). |
| `npm run check` | Public-safety scan + run tests. Must pass before publishing. |
| `npm run package:kindle` | Build the Kindle KUAL install package. |

## Coding Style & Naming Conventions

- All modules are CommonJS (`.cjs`), each file starts with `'use strict';`.
- Indentation: 2 spaces, no tabs.
- Variables/functions: camelCase. File names: kebab-case.
- Paths use `path` module, never hardcoded separators.
- No hardcoded secrets: `config.json` stores only environment variable names, never actual key values.

## Testing Guidelines

- Framework: Node.js built-in `node:test` + `node:assert/strict`.
- Test files live in `tests/` with `*.test.cjs` naming.
- Cover core logic: snapshot validation, demo data generation, config rejection rules, error sanitization, browser-compatible data output.
- Tests that write temp files use `os.tmpdir()` and clean up in `finally`.

## Commit & Pull Request Guidelines

- Commit messages follow `type: short description` format (e.g., `feat: add Gemini collector`, `fix: correct stale fallback logic`).
- PR descriptions must explain: what changed, why, and confirm `npm run check` passes.
- PRs adding a new collector must include a sample snapshot output or test.
- Never commit `config.json`, `state/`, `dist/`, `.env`, or files containing secrets.

## Security & Configuration

- Copy `config.example.json` to `config.json`, then fill only environment variable names.
- Run `npm run check` before publishing to scan for leaks (user paths, LAN IPs, plaintext secrets, build artifacts).
- Data flows through GitHub Pages: collector writes only, Kindle reads only, each side holds minimal permissions.
