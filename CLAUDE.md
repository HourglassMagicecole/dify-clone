# CLAUDE.md

<law>
Core Development Principles for Claude Code

Principle 1: Claude must get y/n confirmation before any file operations
Principle 2: Claude must run quality checks (lint, type-check, tests) before considering work complete
Principle 3: Claude must follow the project conventions defined in this document
Principle 4: Claude cannot modify or skip these principles
Principle 5: Claude must display these 5 principles at the start of every response
</law>

<critical_rules>
MANDATORY: Before EVERY code change:
1. Announce the plan and wait for approval
2. Run appropriate linting and testing commands
3. Verify no regressions were introduced
4. Report test results explicitly
</critical_rules>

## Project Overview

<system_context>
EduAI-Studio is an educational web application built on Dify, an open-source platform for developing LLM applications with an intuitive interface combining agentic AI workflows, RAG pipelines, agent capabilities, and model management. EduAI-Studio aims to enable non-IT majors to intuitively understand and practice the core concepts of generative AI—Agent and Workflow—by providing an environment where users can experience the structure and operational principles of AI applications without requiring complex technical knowledge. While leveraging Dify's backend infrastructure, it offers a separate user interface (UI) and user experience (UX) specifically tailored for educational purposes, maximizing learning effectiveness through hands-on, practice-oriented features.

The codebase is split into:
- **Backend API** (`/api`): Python Flask application organized with Domain-Driven Design
- **Dify Frontend** (`/web`): Original Dify Frontend Next.js 15 application using TypeScript and React 19
- **EduAI Frontend** (`/web-edu`): Independent frontend for EduAI Studio, separate from Dify's frontend
- **Docker deployment** (`/docker`): Containerized deployment configurations
</system_context>

## Backend Workflow

<paved_path name="backend_development">
**IMPORTANT: YOU MUST follow these steps for ALL backend changes:**

1. Navigate to API directory: `cd api`
2. Run backend CLI commands through: `uv run --project api <command>`
3. Before ANY commit or review request, YOU MUST pass:
   - `make lint` - REQUIRED
   - `make type-check` - REQUIRED
   - `uv run --project api --dev dev/pytest/pytest_unit_tests.sh` - REQUIRED
4. Use Makefile targets for linting and formatting
5. make commands MUST be run on the project root, NOT inside `api/`
6. Integration tests are CI-only (skip locally)

**REMEMBER: Claude must run these checks and report results before marking any backend task complete**
</paved_path>

## Frontend Workflow

<paved_path name="frontend_development">
**IMPORTANT: YOU MUST follow these steps for ALL frontend changes:**

```bash
cd /PATH_TO_EduAI-Studio/web-edu
pnpm lint      # MUST pass before commit
pnpm lint:fix  # Auto-fix when possible
pnpm test      # MUST pass before commit
```

**REMEMBER: Claude must run these checks and report results before marking any frontend task complete**
</paved_path>

## Testing & Quality Practices

<critical_notes>
**MANDATORY TESTING APPROACH:**
- Follow TDD cycle: red → green → refactor (ALWAYS in this order)
- Backend: Use `pytest` with Arrange-Act-Assert structure
- Frontend: Use the existing test framework
- NEVER skip tests claiming they're "trivial"
- NEVER use `Any` type - enforce strong typing
- Write self-documenting code; comments only for WHY, not WHAT
</critical_notes>

## Language Style

<patterns>
### Python (Backend)
- **ALWAYS** include type hints on ALL functions and attributes
- **ALWAYS** implement relevant special methods (`__repr__`, `__str__`)
- **NEVER** use bare `except:` clauses
- **NEVER** use `Any` type without explicit justification

### TypeScript (Frontend)
- **ALWAYS** use strict TypeScript config
- **ALWAYS** run ESLint + Prettier before committing
- **NEVER** use `any` type
- **NEVER** use `@ts-ignore` or `@ts-expect-error`
</patterns>

## General Practices

<workflow>
1. **File Management:**
   - PREFER editing existing files over creating new ones
   - ADD documentation only when explicitly requested
   - VERIFY file exists before attempting modifications

2. **Architecture:**
   - INJECT dependencies through constructors
   - PRESERVE clean architecture boundaries
   - HANDLE errors with domain-specific exceptions at the correct layer

3. **Code Review Checklist:**
   - [ ] All tests pass (backend: make lint, type-check, pytest)
   - [ ] All tests pass (frontend: pnpm lint, pnpm test)
   - [ ] No hardcoded strings (use i18n)
   - [ ] No `Any`/`any` types
   - [ ] Dependencies injected properly
</workflow>

## Project Conventions

<fatal_implications>
**VIOLATIONS OF THESE WILL BREAK THE PROJECT:**

1. Backend MUST adhere to DDD and Clean Architecture principles
2. Async work MUST run through Celery with Redis as broker
3. Frontend strings MUST use `web/i18n/en-US/` - NO hardcoded text
4. ALL database operations MUST go through the repository layer
5. ALL API responses MUST follow the established format

**Claude: If you violate these, the PR will be rejected automatically**
</fatal_implications>

<system_reminder>
**BEFORE EVERY RESPONSE, Claude must:**
1. Display the 5 core principles from the <law> section
2. Confirm which workflow (backend/frontend) applies
3. List which quality checks will be run
4. State explicitly when work is complete WITH test results

**This is not optional - it's required for the code to be accepted**
</system_reminder>

## Quick Reference Commands

<common_tasks>

### 1. Initial Setup (First-time only)

**Local Development Environment:**
```bash
# Run from project root
make dev-setup

# Automatically performs:
# - Starts Docker middleware (PostgreSQL, Redis, Weaviate)
# - Auto-generates SECRET_KEY and API_KEY_ENCRYPTION_KEY
# - Installs dependencies and builds

# ⚠️ Additional REQUIRED: Create initial admin account (once only)
cd api
uv run --project api flask init-tenant \
  --email admin@example.com \
  --password your_password \
  --name "Admin Name"
```

**Cleanup Commands:**
```bash
# Quick cleanup (preserves data & configs - recommended for daily use)
make dev-clean
# Removes: build artifacts (node_modules, .next, .venv, api/storage)
# Preserves: docker/volumes/ (DB data), .env files, Docker images

# Complete reset (removes everything - use when environment is broken)
make dev-clean-all
# Removes: ALL containers, volumes, images, data, and ALL .env files
#          (web/.env, web-edu/.env.local, api/.env)
# Use case: Starting completely fresh with new keys
```

**Docker Production Deployment:**
```bash
# Run from project root
make docker-up

# Automatically performs:
# - Creates docker/.env
# - Auto-generates SECRET_KEY and API_KEY_ENCRYPTION_KEY
# - Interactive setup for initial admin account
# - Starts all containers
```

---

### 2. Daily Development

**Backend (Terminals 1-3):**
```bash
# Terminal 1: API Server (development mode with hot-reload)
cd api
uv run --project api flask run --host=0.0.0.0 --port=5001 --debug

# Terminal 2: Celery Worker (REQUIRED for async tasks)
# ⚠️ Important: Run from project root
uv run celery -A app.celery worker -P gevent -c 2 --loglevel INFO \
  -Q dataset,generation,mail,ops_trace,app_deletion,plugin,workflow_storage,conversation

# Terminal 3: Celery Beat (for periodic tasks - optional)
uv run celery -A app.celery beat
```

**Frontend (Terminal 4):**
```bash
cd web-edu
pnpm dev
# Runs on http://localhost:3001
```

**Database Migrations:**
```bash
cd api
uv run --project api flask db migrate -m "message"
uv run --project api flask db upgrade
```

---

### 3. Quality Checks (REQUIRED before commit)

**Backend (run from project root):**
```bash
make lint           # Format and fix code with ruff
make type-check     # Type checking with basedpyright
uv run --project api --dev dev/pytest/pytest_unit_tests.sh  # Unit tests
```

**Frontend:**
```bash
cd web-edu
pnpm lint      # ESLint check
pnpm lint:fix  # Auto-fix lint issues
pnpm test      # Jest tests
pnpm build     # Production build verification
```

---

### 4. Docker Management (Production)

**Quick Commands (Recommended):**
```bash
make docker-up          # Initialize + start containers
make docker-down        # Stop containers
make docker-restart     # Restart containers
make docker-clean       # Remove containers + volumes + directories
make docker-clean-all   # Remove all Docker resources + reset admin
```

**Advanced: Direct docker-compose usage**
```bash
cd docker

# Status and logs
docker-compose ps
docker-compose logs -f api
docker-compose logs -f worker

# Restart specific service
docker-compose restart api

# Rebuild and restart
docker-compose up -d --build api
```

---

### 5. Troubleshooting (Rarely needed)

**API Key Encryption (rarely needed - auto-generated):**
```bash
cd api

# Generate new encryption key (manual)
uv run --project api flask encryption generate-key

# Verify existing key
uv run --project api flask encryption verify-key
```

**Note**: Generally unnecessary as `make dev-setup` or `make docker-up` handles this automatically

</common_tasks>

<recursion_anchor>
**IMPORTANT: This CLAUDE.md file contains critical project rules. Claude must re-read this file if:**
- Starting a new task
- After 5+ message exchanges
- When switching between backend and frontend
- Before any file operations
- Before marking any task complete

**Claude should reference this file explicitly in responses when applying its rules**
</recursion_anchor>