# Project Structure — freely

This document describes the complete folder structure of the freely application,
the purpose of each folder, and guidelines for where to add new code.

## Overview

freely is organized as a full-stack monorepo:

- **backend/** — Python **FastAPI** server application (MVC + OOP; REST API,
  SQL Server via SQLAlchemy + pyodbc, Swagger UI at `/docs`).
- **frontend/** — a [Turborepo](https://turbo.build) monorepo managed with **npm workspaces**,
  containing the web app and all shared frontend packages.

### Tech stack (frontend)

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Framework  | React 19 + Vite 8 + TypeScript                                    |
| Routing    | react-router-dom 7                                                |
| State      | Redux Toolkit + react-redux                                       |
| Styling    | Tailwind CSS 4 + shadcn/ui (Radix primitives, `radix-vega` style) |
| Data fetch | axios                                                             |
| Monorepo   | Turborepo 2 + npm workspaces (`apps/*`, `packages/*`)             |
| Tooling    | ESLint 10, Prettier (+ tailwindcss plugin), Husky + lint-staged   |

---

## Full directory tree

```
freely/
├── backend/                      # Python FastAPI server (MVC + OOP)
│   ├── app/
│   │   ├── main.py               # FastAPI app factory; Swagger UI at /docs
│   │   ├── core/                 # Settings (.env), DB engine/session, security (JWT), exceptions
│   │   ├── models/               # SQLAlchemy ORM models (M in MVC) — one file per HLD module
│   │   ├── schemas/              # Pydantic request/response DTOs
│   │   ├── repositories/         # Data-access layer (OOP classes over the models)
│   │   ├── services/             # Business logic: transactions, scope/permission checks, audit
│   │   ├── controllers/          # FastAPI routers (C in MVC) — thin HTTP layer
│   │   └── utils/                # Secure public-ID generation, UTC helpers
│   ├── database/
│   │   └── schema.sql            # SQL Server DDL generated from docs/freely.dbml
│   ├── .env / .env.example       # All backend environment configuration
│   ├── requirements.txt          # Python dependencies
│   ├── run.py                    # uvicorn launcher
│   └── README.md                 # Backend setup & run guide
│
└── frontend/                     # Turborepo monorepo root
    ├── package.json              # Root workspace manifest (scripts, workspaces)
    ├── turbo.json                # Turborepo pipeline (build, dev, lint, format, typecheck)
    ├── tsconfig.json             # Base TypeScript config shared by all workspaces
    ├── README.md                 # Frontend overview
    ├── .npmrc                    # npm registry/install config
    ├── .prettierrc               # Prettier formatting rules
    ├── .prettierignore           # Files excluded from formatting
    ├── .husky/                   # Git hooks
    │   └── pre-commit            # Runs lint-staged (prettier) before each commit
    │
    ├── apps/                     # Deployable applications
    │   ├── web/                  # Main web app (Vite + React)
    │   │   ├── .env*             # Local Vite environment files (ignored by Git)
    │   │   ├── index.html        # Vite entry HTML
    │   │   ├── package.json      # App manifest (name: "web")
    │   │   ├── vite.config.ts    # Vite config (React, Tailwind, "@" alias → ./src, dev proxy /api → localhost:8000)
    │   │   ├── components.json   # shadcn/ui config for the app
    │   │   ├── eslint.config.js  # App ESLint flat config
    │   │   ├── tsconfig*.json    # App TS configs (app + node/bundler)
    │   │   ├── public/           # Static assets served as-is (favicons, icons, manifest)
    │   │   └── src/              # Application source code
    │   │       ├── main.tsx      # App bootstrap: AppProviders (theme + Redux) + React root
    │   │       ├── App.tsx       # Root component: session bootstrap + <RouterProvider>
    │   │       ├── app/          # App-level setup — providers.tsx (ThemeProvider + Redux Provider)
    │   │       ├── components/   # App components (theme-provider, protected-route, loading-fallback)
    │   │       ├── config/       # Centralized frontend configuration (config.ts reads Vite env values)
    │   │       ├── hooks/        # App-specific hooks (use-auth.ts wraps the auth slice)
    │   │       ├── layouts/      # Layout shells: root-layout.tsx (nav + API health), auth-layout.tsx
    │   │       ├── pages/        # Route pages by domain: auth/, feed/, grievances/, jobs/, …
    │   │       ├── pwa/          # Progressive Web App code (SW, manifest, offline)
    │   │       ├── routes/       # index.tsx — router; every page lazy-loaded (React.lazy + Suspense)
    │   │       ├── services/     # Axios client (api.ts) + one typed service per backend controller
    │   │       ├── store/        # Redux store, auth-slice.ts, typed hooks (useAppDispatch/useAppSelector)
    │   │       └── types/        # DTO types mirroring backend/app/schemas/*.py
    │   └── logs/                 # Reserved for app log output (or a future logs app)
    │
    ├── packages/                 # Shared, publishable-style internal packages
    │   ├── ui/                   # @workspace/ui — design system
    │   │   ├── package.json      # Package manifest (exports map below)
    │   │   ├── components.json   # shadcn/ui config for the package
    │   │   ├── eslint.config.js  # Package ESLint flat config
    │   │   ├── tsconfig*.json    # Package TS configs
    │   │   └── src/
    │   │       ├── components/   # Shared UI components (shadcn/ui, e.g. button.tsx)
    │   │       ├── hooks/        # Shared React hooks
    │   │       ├── lib/          # Shared helpers (e.g. cn() in utils.ts)
    │   │       └── styles/       # globals.css — Tailwind theme & design tokens
    │   ├── auth/                 # @workspace/auth — JWT token storage (localStorage helpers)
    │   ├── constants/            # @workspace/constants — API_ENDPOINTS (every backend route) + APP_ROUTES
    │   └── utils/                # @workspace/utils — date formatting, FastAPI error extraction
    │
    ├── docs/                     # Project documentation (this file lives here)
    └── infra/                    # Infrastructure & deployment (Docker, CI/CD, env templates)
```

---

## Folder-by-folder purpose

### Root

| Path       | Purpose                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `backend/` | FastAPI backend: REST API (Swagger at `/docs`), SQL Server schema, MVC layers. |
| `frontend/` | All client-side code: apps + shared packages, orchestrated by Turborepo.      |

### `backend/` — FastAPI server

The backend follows **MVC + OOP**: `controllers/` (routers) → `services/` (business
logic, transactions, audit) → `repositories/` (data access) → `models/` (SQLAlchemy
ORM). The **View** is the React frontend plus the auto-generated Swagger UI. Each
layer contains one file per HLD module (`identity`, `organization`, `social`,
`grievance`, `ai`, `workflow`, `sla`, `notification`, `job`).

| Path                    | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `backend/app/main.py`   | App factory, CORS, exception handlers, router mounting, Swagger (`/docs`).  |
| `backend/app/core/`     | `config.py` reads `.env`; `database.py` engine/session; `security.py` JWT + bcrypt; `exceptions.py` domain errors. |
| `backend/app/models/`   | ORM models mirroring `freely.dbml` (45 tables, CHECK constraints, indexes). |
| `backend/app/schemas/`  | Pydantic DTOs; enum fields use `Literal` so Swagger renders dropdowns.      |
| `backend/app/repositories/` | Query classes (e.g. `PostRepository.list_feed`).                        |
| `backend/app/services/` | Use-case classes; multi-table writes commit in one transaction.            |
| `backend/app/controllers/` | FastAPI routers exposing the LLD API surface under `/api/v1`.           |
| `backend/database/schema.sql` | Executable SQL Server DDL generated from `docs/freely.dbml` (+ platform-role seeds). |
| `backend/.env`          | All environment config (DB, JWT secret, CORS, storage, AI service). Git-ignored. |

#### What was created (backend)

- **SQL Server DDL** — `backend/database/schema.sql`, generated from `docs/freely.dbml`
  (45 tables, CHECK-constraint enums, UTC `datetime2` defaults, indexes, `platform_roles` seeds).
- **FastAPI backend** — MVC + OOP under `backend/app` or Swagger testing.
- **Environment configuration** — `backend/.env` (git-ignored) + `backend/.env.example`
  template; loaded by `backend/app/core/config.py`.
- **REST API surface** — the LLD API exposed under `/api/v1`; interactive Swagger UI at
  `/docs` for testing (register via `POST /api/v1/users`, log in via `POST /api/v1/auth/login`,
  then click **Authorize**).
- **Launcher & deps** — `backend/run.py` (uvicorn) and `backend/requirements.txt`.

### `frontend/` root files

| File / folder   | Purpose                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `package.json`  | Declares workspaces (`apps/*`, `packages/*`) and root scripts (`dev`, `build`, `lint`, `format`, `typecheck`). |
| `turbo.json`    | Turborepo task pipeline with dependency-aware builds and caching.                |
| `tsconfig.json` | Base TypeScript configuration extended by every workspace.                       |
| `.husky/`       | Git hooks; `pre-commit` runs lint-staged → Prettier on staged files.             |
| `.prettierrc`   | Shared formatting rules (incl. `prettier-plugin-tailwindcss`).                   |
| `.npmrc`        | npm configuration for the monorepo.                                              |

### `frontend/apps/` — applications

Each subfolder is an independently buildable/deployable app.

- **`apps/web/`** — the main web application (Vite + React 19 + Tailwind 4).
  Consumes shared code via the `@workspace/*` packages and imports local code with the
  `@/*` alias (`@` → `apps/web/src`).
- **`apps/logs/`** — reserved; use for runtime log output or a future logging app.

#### `apps/web/src/` folders

| Folder        | What goes here                                                                  |
| ------------- | ------------------------------------------------------------------------------- |
| `app/`        | App-level wiring: provider composition, global setup.                            |
| `components/` | Reusable components **specific to this app** (e.g. `theme-provider.tsx`).        |
| `config/`     | Centralized frontend configuration; `config.ts` reads Vite environment values. |
| `hooks/`      | Custom React hooks used only by this app.                                        |
| `layouts/`    | Page shells that wrap routes (e.g. `DashboardLayout`, `AuthLayout`).             |
| `pages/`      | Route-level components — one per screen.                                         |
| `pwa/`        | Service worker registration, web app manifest, offline/update logic.             |
| `routes/`     | Router setup: lazy route objects (`React.lazy` + `Suspense`), `ProtectedRoute` guards. |
| `services/`   | Shared Axios client (`api.ts`: Bearer interceptor, 401 handling) + typed API services. |
| `store/`      | Redux store configuration, slices (auth), typed hooks, selectors.                      |
| `types/`      | App-specific TypeScript types, interfaces, DTOs (mirror backend Pydantic schemas).     |

#### What was created (frontend wiring)

- **API service layer** — `apps/web/src/services/`: a shared Axios client (`api.ts`) that
  attaches the stored JWT to every request and clears the session on 401, plus one typed
  service module per backend controller (`identity`, `organization`, `social`, `grievance`,
  `workflow`, `ai`, `sla`, `notification`, `job`, `health`) covering every `/api/v1` endpoint.
- **DTO types** — `apps/web/src/types/`: TypeScript interfaces mirroring every Pydantic
  schema in `backend/app/schemas/` (Literal → string-union, datetime → `string`).
- **Lazy-loaded router** — `apps/web/src/routes/index.tsx`: every page ships as its own
  chunk via `React.lazy` + `Suspense`; `ProtectedRoute` guards authenticated screens.
- **Auth flow** — Redux auth slice (`src/store/auth-slice.ts`): `login` (OAuth2 password
  flow → stores token), `bootstrapSession` (restores the session on startup), `logout`;
  consumed through the `useAuth()` hook in `src/hooks/`.
- **Pages** — feed (composer, likes, bookmarks, comments), grievances (submit, my list,
  public tracking, detail with SLA clock + status timeline + feedback), jobs (search,
  detail, apply/save), notifications, profile, public organization/user/post pages,
  login/register.
- **Dev proxy** — `apps/web/vite.config.ts` forwards `/api` to `http://localhost:8000`, so
  the app talks to the backend with zero env/CORS setup (`VITE_API_BASE_URL` override
  documented in `apps/web/.env.example`).
- **Shared packages filled in** — `@workspace/constants`, `@workspace/auth` and
  `@workspace/utils` (previously empty placeholders) now hold the app-agnostic pieces
  that future apps under `apps/` can reuse.

### `frontend/packages/` — shared packages

Each subfolder is an npm workspace package consumed by apps through the `@workspace/*` scope.

| Package                | Status  | Purpose                                                                 |
| ---------------------- | ------- | ----------------------------------------------------------------------- |
| `packages/ui/`         | ✅ Ready | `@workspace/ui` — design system: shadcn/ui components (button, card, input, textarea, label, badge), `cn()` util, global Tailwind styles. |
| `packages/auth/`       | ✅ Ready | `@workspace/auth` — JWT token storage (`tokenStorage`, localStorage key `freely.access_token`) shared by every app. |
| `packages/constants/`  | ✅ Ready | `@workspace/constants` — `API_ENDPOINTS` (1:1 with the backend controllers) and `APP_ROUTES` (client route paths). |
| `packages/utils/`      | ✅ Ready | `@workspace/utils` — `formatDate` / `formatDateTime`, `getApiErrorMessage` (FastAPI error shapes). |

#### `@workspace/ui` export map

| Import path                     | Source                          |
| ------------------------------- | ------------------------------- |
| `@workspace/ui/globals.css`     | `src/styles/globals.css`        |
| `@workspace/ui/components/*`    | `src/components/*.tsx`          |
| `@workspace/ui/hooks/*`         | `src/hooks/*.ts`                |
| `@workspace/ui/lib/*`           | `src/lib/*.ts`                  |

`@workspace/auth`, `@workspace/constants` and `@workspace/utils` each export
`./src/index.ts` as their root entry (e.g. `import { tokenStorage } from "@workspace/auth"`),
plus deep exports such as `@workspace/constants/api-endpoints`. They are source-export
packages — apps consume the TypeScript directly, no build step required.

### Other top-level frontend folders

| Folder   | Purpose                                                                                  |
| -------- | ---------------------------------------------------------------------------------------- |
| `docs/`  | All project documentation. **Add new `.md` docs here** (this file is the index of structure). |
| `infra/` | Infrastructure-as-code and deployment assets: Dockerfiles, CI/CD pipelines, `.env` templates, reverse-proxy config. |

---

## Where to add new code (decision guide)

| You want to add…                              | Put it in…                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| A new screen / page                           | `apps/web/src/pages/` + register it in `apps/web/src/routes/`              |
| A layout wrapping several pages               | `apps/web/src/layouts/`                                                    |
| A UI component reused across the design system | `packages/ui/src/components/` (import via `@workspace/ui/components/…`)    |
| A component only this app needs               | `apps/web/src/components/`                                                 |
| A shared React hook                           | `packages/ui/src/hooks/` (or a new package if non-UI)                      |
| An app-only hook                              | `apps/web/src/hooks/`                                                      |
| An API call / endpoint                        | `apps/web/src/services/` (path constant goes in `packages/constants/src/api-endpoints.ts`) |
| Global state (slice, selector)                | `apps/web/src/store/`                                                      |
| A type shared across apps/packages            | The relevant `packages/*` (or create `packages/types`)                     |
| An app-only type                              | `apps/web/src/types/`                                                      |
| PWA behavior (offline, install prompt)        | `apps/web/src/pwa/`                                                        |
| Shared constants / enums                      | `packages/constants/`                                                      |
| Auth logic (tokens, guards, session)          | `packages/auth/`                                                           |
| A pure helper function (dates, strings…)      | `packages/utils/`                                                          |
| A new deployable app (admin, mobile web…)     | New folder under `apps/` (auto-picked up by the `apps/*` workspace glob)   |
| Documentation                                 | `docs/`                                                                    |
| Docker / CI / deployment config               | `infra/`                                                                   |
| Backend endpoints / models / services         | `backend/app/` (`controllers`, `services`, `repositories`, `models`); DB DDL in `backend/database/schema.sql` |

### Should you add a new folder?

- **New app?** → add `apps/<name>` — no config change needed, the `apps/*` workspace glob covers it.
- **New shared package?** → add `packages/<name>` with a `package.json` named `@workspace/<name>` — also auto-covered by `packages/*`.
- **New `src` concern in the web app?** → prefer an existing folder; only add a new one under `apps/web/src/` if none of the ten existing categories fit.
- Everything else (docs, infra, backend) already has a designated top-level home — **no new top-level folders are needed**.

---

## Common commands

Run from `frontend/`:

```bash
npm run dev         # Start all apps in dev mode (turbo dev)
npm run build       # Build all apps/packages (turbo build)
npm run lint        # Lint every workspace
npm run typecheck   # Type-check every workspace
npm run format      # Format every workspace with Prettier
```

Add a shadcn/ui component (from `apps/web/`):

```bash
npx shadcn@latest add <component>   # Installs into packages/ui/src/components
```

#### Running the backend (from `backend/`)

**Prerequisites:** **Python 3.14** (pinned — see note below), Microsoft SQL Server
running locally, and the
[Microsoft ODBC Driver 18 for SQL Server](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server)
(required by pyodbc). `sqlcmd` is optional — the schema can also be applied from
SSMS / Azure Data Studio.

> **Why Python 3.14 exactly?** The newest releases of the binary dependencies
> (`pyodbc`, `pydantic-core`, `SQLAlchemy`, `pyyaml`, `httptools`, `websockets`)
> ship **cp314-only Windows wheels**. On Python 3.15 there are no wheels at all,
> so pip tries to compile from source and fails without the MSVC C++ Build Tools;
> on Python 3.13 pip resolves binaries that fail at import time. Install Python
> 3.14 (python.org installer or the Python Install Manager) until the ecosystem
> catches up.

```bash
# 1. One-time setup
py -3.14 -m venv .venv          # use the 3.14 launcher explicitly
.venv\Scripts\activate          # cmd; PowerShell: .venv\Scripts\Activate.ps1 ; bash: source .venv/Scripts/activate
pip install -r requirements.txt
copy .env.example .env          # bash: cp .env.example .env  — then edit values (SECRET_KEY, DB settings)

# 2. Create the database and apply the schema (only on an empty database)
#    Windows Authentication (current Windows user):
sqlcmd -S localhost -E -Q "CREATE DATABASE freely"
sqlcmd -S localhost -E -d freely -i database/schema.sql
#    …or with a SQL login:
#    sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -Q "CREATE DATABASE freely"
#    sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -d freely -i database/schema.sql

# 3. Run the API (host/port come from .env: HOST, PORT; default 0.0.0.0:8000)
python run.py                   # equivalent to: uvicorn app.main:app --reload
```

**Database authentication (`backend/.env`):** both SQL Server modes are supported —

| Mode | `.env` setting |
| ---- | -------------- |
| Windows Authentication (typical for local dev) | leave `DB_USER=` and `DB_PASSWORD=` empty — the backend connects as the current Windows user via `Trusted_Connection=yes` |
| SQL Server login | set `DB_USER` / `DB_PASSWORD` (e.g. `sa`) |

Whichever login is used must exist in SQL Server and have access to the `freely`
database (a Windows login needs to be mapped to a database user with read/write).

**Verify it works:**

| Check | URL | Expected |
| ----- | --- | -------- |
| Health probe | http://localhost:8000/api/v1/health | `{"status":"ok"}` |
| DB probe | http://localhost:8000/api/v1/health/db | `{"status":"ok","database":"reachable"}` |
| Swagger UI | http://localhost:8000/docs | interactive API docs |
| ReDoc | http://localhost:8000/redoc | alternative docs |

## Conventions

- **Path alias `@`** → `apps/web/src` (configured in `vite.config.ts`).
- **Frontend environment variables** belong in `apps/web/.env` (or the Git-ignored `apps/web/.env.local`). In dev no variable is needed: the Vite proxy forwards `/api` to `http://localhost:8000` (`apps/web/src/config/config.ts` uses `/api` when `VITE_API_BASE_URL` is unset). Use the shared Axios client from `apps/web/src/services/api.ts` for web API calls. Vite bundles `VITE_` variables into browser code, so never put secrets in them.
- **API paths** are centralized in `@workspace/constants` (`API_ENDPOINTS`) — never hardcode endpoint strings in components or services.
- **Client route paths** come from `APP_ROUTES` (`@workspace/constants`); register pages in `apps/web/src/routes/index.tsx` with `React.lazy` so every route stays a separate chunk.
- **Auth token** lives in `@workspace/auth` `tokenStorage` (localStorage key `freely.access_token`); the Axios client attaches it automatically — services never set auth headers by hand.
- **ESLint**: `react-hooks/set-state-in-effect` forbids synchronous `setState` in effect bodies — validate route params during render and keep state updates inside async callbacks.
- **Backend environment variables** belong in `backend/.env` (Git-ignored; template: `backend/.env.example`): DB credentials, JWT secret, CORS origins, storage, AI service. Settings are loaded by `backend/app/core/config.py`.
- **API contract**: the backend serves REST under `/api/v1` and Swagger UI at `/docs`; point `VITE_API_BASE_URL` at the backend origin during local development.
- **Shared code** is imported via `@workspace/*` package names, never relative paths across workspaces.
- **Styling**: Tailwind 4 utility classes; design tokens live in `packages/ui/src/styles/globals.css`.
- **Formatting/linting** run automatically on commit via Husky + lint-staged.
- **Node ≥ 20.19** and **npm 11** are required (`engines` in the root `package.json`).
