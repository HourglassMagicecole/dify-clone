# MAI Studio

> An education-focused AI platform built on Dify — internal private fork

## About

MAI Studio is an internal private fork of [Dify](https://github.com/langgenius/dify) v1.9.1, with an education domain layer (sessions, role-based access, usage tracking, LMS SSO, admin API keys, and pricing / model provider management) overlaid on top. We keep the upstream Dify code largely untouched and isolate the education features into dedicated modules (`api/services/edu/`, `api/services/education_management/`, `api/controllers/console/edu/`, `api/models/education/`, and `web-edu/`) to keep upstream merges as straightforward as possible.

This repository is private and intended for internal and partner use only. External contributions are not accepted.

## Quick Start

Pick the document that matches what you are doing:

- **Deploying on a customer server** (Rocky Linux 9):
  → [`docs/deployment-guide.md`](../docs/deployment-guide.md)
- **DNS cutover or migrating to a new server**:
  → [`docs/migration-notes.md`](../docs/migration-notes.md)
- **Setting up a local development environment**:

  ```bash
  make dev-setup                                                          # Full stack (docker middleware + web + api + web-edu)
  cd web-edu && pnpm dev                                                  # MAI Studio frontend (http://localhost:3001)
  cd api && uv run flask run --host 0.0.0.0 --port 5001 --debug           # Backend API
  ```

  See the "Quick Reference Commands" section in [`CLAUDE.md`](../CLAUDE.md) for the full command list (formatting, tests, DB migrations, and so on).

## What MAI Studio Adds on Top of Dify

| Location | Purpose |
|----------|---------|
| `api/services/edu/` | Core education services (sessions, resource tagging — 5 files) |
| `api/services/education_management/` | Management services (API keys, quotas, dashboard, usage analytics — 14 files) |
| `api/controllers/console/edu/` | Education-domain Blueprint controllers (Flask function-view pattern) |
| `api/models/education/` | 15 education-domain SQLAlchemy entities |
| `api/tasks/education/` | Education-domain Celery background tasks |
| `web-edu/` | MAI Studio frontend (Next.js 15, port 3001) |

Key capabilities:

- **Session and member management** — Data isolation per education session
- **Role-based access control** — Three-tier permissions (Owner / Admin / Normal)
- **Per-session and per-user usage quotas** — Model-call cost limits and usage analytics
- **LMS SSO** — Cookie-based integration with external LMS (`MOAI_LOGIN_EMAIL`, etc.)
- **Admin API key management** — Issue and revoke API keys per session
- **Pricing and model provider management** — Admin console for model pricing and provider configuration

## Repository Layout

| Directory | Purpose |
|-----------|---------|
| `api/` | Flask backend (upstream Dify + education modules) |
| `web/` | Upstream Dify frontend (kept for reference, not used in production) |
| `web-edu/` | MAI Studio frontend (Next.js 15, port 3001) |
| `docker/` | Production Docker Compose stack, nginx, init scripts |
| `docs/` | Operations guides (deployment, migration) |
| `_bmad-output/` | Project context, stories, and artifacts |
| `LICENSE` | Dify Open Source License (fork obligation) |

## Documentation Index

- [`docs/deployment-guide.md`](../docs/deployment-guide.md) — Production deployment guide (Rocky Linux 9)
- [`docs/migration-notes.md`](../docs/migration-notes.md) — DNS cutover and server migration runbook
- [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) — Code rules, architecture, security and testing rules
- [`CLAUDE.md`](../CLAUDE.md) — Developer command quick reference (lint, test, migration, etc.)

## Contribution Policy

This is an internal fork. External contributions are not accepted.

## License

Inherits the Dify Open Source License. See [`LICENSE`](../LICENSE) for details.

---

한국어: [../README.md](../README.md)
