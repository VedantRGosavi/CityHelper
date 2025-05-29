# DEVELOPMENT_GUIDE.md
CityHelper • Contributor Handbook  
_Last updated: 2025-05-28_

---

## 1. Prerequisites

| Tool | Version (min) | Notes |
|------|---------------|-------|
| Git | 2.40 | SSH keys configured |
| Docker | 26.x | + Docker Compose v2 |
| Python | 3.12 | `pyenv` recommended |
| Node.js | 20.x | `corepack enable` for pnpm |
| pnpm | 9.x | shipped with corepack |
| PostgreSQL client | 16 | psql in PATH |
| Redis client | 7 | redis-cli in PATH |

> **Tip**: All services can be started via Docker; native installs are optional.

---

## 2. Quick-Start (all-in-one)

```bash
git clone git@github.com:VedantRGosavi/CityHelper.git
cd CityHelper
make dev   # builds & starts backend, frontend, db, redis, mailhog
```

Browse:  
* Frontend: http://localhost:5173  
* API Docs: http://localhost:8000/docs  
* DB: `psql -h localhost -p 5432 -U cityhelper cityhelper` (pwd `cityhelper`)  

To stop: `make stop`.

---

## 3. Manual Local Setup (optional)

1. **Backend**

   ```bash
   cd api
   pyenv install 3.12.2
   pyenv local 3.12.2
   poetry install --with dev
   cp .env.sample .env
   uvicorn app.main:app --reload
   ```

2. **Frontend**

   ```bash
   cd web
   pnpm install
   cp .env.sample .env
   pnpm dev
   ```

3. **Database**

   ```bash
   docker compose up -d db redis
   alembic upgrade head
   ```

---

## 4. Repository Layout

```
.
├── api/                 # FastAPI application
│   ├── app/
│   │   ├── core/        # settings, security, utils
│   │   ├── models/      # SQLModel ORM entities
│   │   ├── api/         # routers grouped by domain
│   │   ├── services/    # business logic
│   │   ├── integrations/# external API adapters
│   │   └── tests/
│   └── alembic/         # migrations
├── web/                 # React + Vite SPA
│   ├── src/
│   │   ├── components/  # shadcn cloned components
│   │   ├── features/    # feature-based folders
│   │   ├── hooks/
│   │   ├── lib/        # API clients, utils
│   │   └── tests/
│   └── tailwind.config.ts
├── infra/               # Terraform & IaC
├── docs/                # Markdown docs, ADRs
├── .github/
│   ├── workflows/       # CI/CD pipelines
│   └── PULL_REQUEST_TEMPLATE.md
└── docker-compose.yml
```

---

## 5. Coding Standards

### 5.1 Python (Backend)

* **Formatting**: `black` (`make fmt`)  
* **Imports**: `isort` with Black profile  
* **Linting**: `ruff` `${PROJECT_ROOT}/api`  
* **Typing**: full type hints; run `mypy` (`make typecheck`)  
* **Docstrings**: NumPy style; mandatory for public functions/classes.

### 5.2 TypeScript / React (Frontend)

* **Formatter**: `prettier` (`pnpm fmt`)  
* **Linting**: `eslint` (React + TS) + `eslint-plugin-tailwindcss`  
* **Component Guidelines**
  * Prefer functional components with hooks.
  * Co-locate test file `Component.test.tsx`.
  * Use [shadcn/ui](https://ui.shadcn.com) generator; never modify library code inside `node_modules`.
* **State**: TanStack Query for server data; Zustand for local atomics.

### 5.3 General

* Follow **12-Factor** principles.  
* No secrets committed—use `.env`, Vault, or GitHub secrets.  
* TODO / FIXME comments: `# TODO(username) 2025-MM-DD: description`.

---

## 6. Git Workflow

### 6.1 Branching Model

* Permanent branches: `main`, `develop`.
* Feature branches from `develop`:
  * `feat/<scope>` – new feature
  * `fix/<scope>` – bug fix
  * `docs/<scope>` – docs only
  * `chore/<scope>` – tooling, CI, refactor
* Hotfix from `main`: `hotfix/<ticket>`.

### 6.2 Commit Messages – Conventional Commits

```
<type>(scope): concise summary

Body (optional, wrap at 72). Reference issues #123.
```

Allowed `type`: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`.

### 6.3 Pull Requests

1. Push branch; open PR to `develop`.
2. Template auto-applied – fill all sections.
3. Checks must pass:
   * Lint & format
   * Unit tests
   * Coverage ≥ target
   * Build image
4. At least **1 approving review** and **0 blocking comments**.
5. **Squash & merge** via GitHub UI.

`main` is _protected_; only fast-forward merges from GitHub Actions after passing staging smoke tests.

---

## 7. Testing Procedures

| Layer | Framework | Command |
|-------|-----------|---------|
| Unit (backend) | `pytest` + `pytest-asyncio` | `make test` |
| Unit (frontend) | `vitest` + RTL | `pnpm test` |
| API contract | `schemathesis` against `/openapi.json` | `make contract-test` |
| E2E | `playwright` | `make e2e` |
| Perf | `k6` scripts in `tests/perf` | `make perf` |

### 7.1 Coverage Targets

* Backend ≥ 85 % statements  
* Frontend ≥ 80 % lines

Coverage gates enforced in CI.

### 7.2 Pre-commit Hooks

Install once:

```bash
pre-commit install
```

Hooks run Black, Ruff, isort, Prettier, eslint, and basic tests.

---

## 8. Continuous Integration / Deployment

GitHub Actions pipelines:

1. **Lint & Test** – runs on every push/PR.  
2. **Build** – docker images pushed to GHCR with `sha` tag.  
3. **Preview Deploy** – for PRs, auto-deploy to Vercel/Railway preview.  
4. **Staging Deploy** – merge to `main` triggers Terraform + Railway/Vercel.  
5. **Production Promote** – manual job with on-call approval.

Status checks must be green before merge.

---

## 9. Documentation Requirements

* **Code Docs** – docstrings (Python) generate via `pdoc`.  
* **API Docs** – FastAPI auto OpenAPI; commit ADR for breaking changes.  
* **Feature Specs** – each epic owns a `docs/specs/<epic>.md`.  
* **Architecture Decision Records (ADR)** – template in `docs/adr/0000-template.md`.  
* **Storybook (optional)** – run `pnpm storybook` for UI catalog.

Contribution to docs is first-class; PRs failing doc lint (`markdownlint`) are blocked.

---

## 10. Helpful Scripts

| Command | Description |
|---------|-------------|
| `make dev` | Start full stack (Docker) with hot reload |
| `make fmt` | Run Black + isort + Prettier |
| `make lint` | Ruff + ESLint |
| `make test` | Backend unit tests |
| `make stop` | Tear down docker stack |
| `pnpm check` | Type-check TS |
| `pnpm ui:add <component>` | Generate new shadcn component |

---

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `psycopg2` fails to connect | ensure DB up `docker compose ps db` |
| CORS error in browser | check `FRONTEND_URL` env var matches origin |
| `mypy` complains about SQLModel | run with plugin: `make typecheck` |
| Port 5173 busy | set `VITE_PORT` in `web/.env` |

---

## 12. Getting Help

* Slack `#cityhelper-dev` – engineering questions  
* GitHub Issues – bugs & enhancements  
* PagerDuty – production incidents (see runbook)

Happy building! ✨
