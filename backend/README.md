# Freely — Backend

Python **FastAPI** REST API for the Freely platform (professional social network,
grievance management, jobs & recruitment), backed by **Microsoft SQL Server**.

- **Architecture:** MVC + OOP — `controllers` (HTTP layer / routers) → `services`
  (business logic, transactions, scope & permission checks) → `repositories`
  (data access) → `models` (SQLAlchemy ORM). The **View** is the frontend
  (React PWA in `frontend/`) plus the auto-generated **Swagger UI**.
- **Source of truth for the DB schema:** `docs/freely.dbml` →
  executable DDL in `database/schema.sql`.
- **API docs (Swagger):** http://localhost:8000/docs — ReDoc: http://localhost:8000/redoc

## Project layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app: middleware, routers, Swagger
│   ├── core/                # Settings (.env), DB engine/session, security (JWT), exceptions
│   ├── models/              # SQLAlchemy ORM models (Model layer), one file per HLD module
│   ├── schemas/             # Pydantic request/response DTOs
│   ├── repositories/        # Data-access classes (OOP)
│   ├── services/            # Business logic classes (transactions, audit, notifications)
│   ├── controllers/         # FastAPI routers (Controller layer), thin HTTP wrappers
│   └── utils/               # Secure public IDs, UTC helpers
├── database/
│   └── schema.sql           # SQL Server DDL generated from docs/freely.dbml
├── .env                     # Local environment (git-ignored)
├── .env.example             # Environment template
├── requirements.txt
└── run.py                   # uvicorn launcher
```

## Setup

**Prerequisites:** **Python 3.14** (the newest binary wheels — pyodbc,
pydantic-core, SQLAlchemy, pyyaml — are cp314-only on Windows; 3.15 has no wheels
and fails to build without MSVC Build Tools), Microsoft SQL Server, and the
**ODBC Driver 18 for SQL Server**.

```bash
cd backend

# 1. Create a virtual environment and install dependencies
py -3.14 -m venv .venv          # use the 3.14 launcher explicitly
.venv\Scripts\activate          # Windows (bash: source .venv/Scripts/activate)
pip install -r requirements.txt

# 2. Configure environment
copy .env.example .env          # then edit .env (see note on DB auth below)

# 3. Create the database and apply the schema
#    Windows Authentication (current Windows user):
sqlcmd -S localhost -E -Q "CREATE DATABASE freely"
sqlcmd -S localhost -E -d freely -i database/schema.sql
#    …or with a SQL login:
#    sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -Q "CREATE DATABASE freely"
#    sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -d freely -i database/schema.sql

# 4. Run the API
python run.py
```

**Database authentication:** leave `DB_USER=` / `DB_PASSWORD=` empty in `.env` to
use **Windows Authentication** (`Trusted_Connection=yes`, connects as the current
Windows user); set them to use a SQL Server login instead. Either way the login
must have access to the `freely` database.

Open **http://localhost:8000/docs** to test every endpoint with Swagger UI.
Use `POST /api/v1/users` to register, then `POST /api/v1/auth/login` and click
**Authorize** in Swagger to call protected endpoints.

## Module map (mirrors HLD §4)

| Module | Models / schemas / controllers | Responsibility |
|---|---|---|
| Identity & Access | `identity`, `organization` | users, orgs, departments, roles, memberships, platform roles |
| Social Graph | `social` | posts, media, likes, reposts, bookmarks, comments, hashtags, mentions, views |
| Grievances | `grievance` | categories, grievances, attachments, post links |
| AI Assessment | `ai` | AI triage with human review gate |
| Workflow | `workflow` | assignments, status history, responses |
| SLA & Escalation | `sla` | policies, clocks, escalations, breach scan |
| Notifications & Audit | `notification` | notifications, feedback, audit logs |
| Jobs & Recruitment | `job` | postings, gov details, receipts, applications, decisions, results |

## Conventions

- All timestamps are `datetime2` in **UTC** (`SYSUTCDATETIME()` at the DB,
  `app.utils.utcnow()` in the app).
- Public identifiers (`public_post_id`, `public_job_id`, `tracking_number`) are
  cryptographically secure random strings from `app/utils/ids.py` — never expose
  sequential IDs.
- Enum-like values are `NVARCHAR` + `CHECK` constraints in the DB and `Literal`
  types in the Pydantic schemas.
- Multi-entity writes run in a **single DB transaction** (see services).
- Append-only tables (`*_status_history`, `audit_logs`, `job_receipts`,
  `post_views`) are never updated — corrections create new rows.
