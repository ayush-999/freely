# Running and activating encrypted messaging

Implemented and verified on 4–5 November 2026. Chat is integrated into the
existing React/FastAPI application and remains **disabled by default**. No SQL,
migration, database connectivity probe or live application query was executed.
Existing database contents have not been inspected or changed.

## Deliverables

- [Updated complete schema](../backend/database/schema.sql): the original 47
  tables plus five chat tables. This is an empty-database creation script.
- [Standalone manual upgrade](../backend/database/migrations/001_chat_up.sql)
  and [guarded rollback](../backend/database/migrations/001_chat_down.sql).
- [Database changes, ordering and owner-run checks](chat-database.md).
- [REST APIs, WebSocket events and backend activation](chat-api.md).
- [Encryption, identity verification, storage and test reproduction](chat-encryption.md).
- [Every added/modified file and its purpose](chat-changes.md).

The client uses the pinned `@getmaapp/signal-wasm@0.6.6` artifact. Its existing
Signal APIs restore durable identity pins through a tested temporary-session
hydration adapter; no custom protocol or cryptographic algorithm was added.
Native libsignal is a test peer only. Private keys and plaintext are confined
to the browser; backend DTOs/storage relay ciphertext and public material.
Chat's transient view state uses a page-scoped controller and React's existing
subscription API. The existing Redux authentication remains authoritative;
no second store or state-management dependency was introduced, and decrypted
history stays out of Redux developer tools.

## Manual database execution

1. Keep `CHAT_ENABLED=false`. Back up the existing database and inspect the
   standalone upgrade and database documentation.
2. Select your intended existing database in SSMS and execute
   `backend/database/migrations/001_chat_up.sql` yourself. Alternatively, from
   `backend`, adapt the server/database names in this **owner-run** command:

   ```powershell
   sqlcmd -S localhost -E -d freely -b -i database/migrations/001_chat_up.sql
   ```

3. Perform the documented migration/constraint/concurrent-key-claim checks in
   your own controlled MSSQL environment. Editing the schema file did not apply
   these changes. The implementation tests deliberately blocked all database
   connections, so actual MSSQL execution/locking remains unverified.
4. Do not run the entire `schema.sql` against your existing populated database.
   It retains the original empty-database creation definitions and seed inserts.

The upgrade is transactional and stops on incompatible/partial chat objects.
Its catalog verification uses SQL Server's own expression parsing for CHECK
definitions instead of guessing how `IN`/`BETWEEN` appear in system metadata.
A temporary reference object is session-local and leaves no additional
persistent table. The rollback refuses if any chat table contains data; after
use, disabling chat while retaining ciphertext is the safe application rollback.

## Run the existing application

Use the existing backend virtual environment and configuration:

```powershell
cd backend
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe run.py
```

Keep existing SQL Server authentication/settings. The new examples in
`backend/.env.example` are additions; do not replace your `.env` with the example.
Use a single backend worker/instance for the current connection hub and limiter.
The application does not create tables or run migrations at startup.

For the existing frontend development setup, either use `docker compose up
--build` from the repository root or run on the host:

```powershell
cd frontend
npm ci
npm run dev -w web -- --host 127.0.0.1 --port 5173
```

The frontend's existing API base must point to the current versioned prefix,
normally `VITE_API_BASE_URL=/api/v1`; the shared Axios conventions are preserved.
Vite now forwards WebSocket upgrades through its existing `/api` proxy.

After manually applying and checking the migration and accepting the tested
crypto release, add these settings to your existing backend `.env` and restart:

```dotenv
CHAT_SCHEMA_READY=true
CHAT_CRYPTO_READY=true
CHAT_ENABLED=true
CHAT_WORKER_COUNT=1
```

Set explicit matching `CHAT_ALLOWED_ORIGINS` or reuse your CORS origin list.
The DB-free `/api/v1/chat/config` reports activation. Other chat routes fail
closed while any readiness flag is false. A missing migration produces a
redacted chat-specific storage error without changing unrelated routes.

Open **Messaging** in the existing navigation, find a person, and open their
conversation. Both people must first open Messaging to register browser devices.
Compare each destination device's safety number over a trusted independent
channel and enter the matching number to enable sending. New devices require
verification. History is stored in a separate encrypted local archive; a new
browser cannot automatically decrypt another device's old messages.
Delayed initial session messages require the receiving device's retained private
prekeys; the documented retention window is 30 days. Expired initial-session
messages can become undecryptable, while an existing established session and
its already stored history have a separate lifecycle.

Production requires HTTPS/WSS and trusted proxy configuration. Build the static
frontend with `npm run build -w web`; its document includes a strict script/style
CSP with the specific WASM permission. An optional deployment example is
`frontend/deploy/nginx.conf.example`; supply real DNS/TLS paths and trusted
upstream settings before using it. This example was not deployed here.
The existing Dockerfile/Compose remain the development setup.

## Tests and evidence

Backend tests use real FastAPI HTTP/WebSocket adapters backed by an explicit
in-memory repository. Their fixture denies engine/dialect connections, so tests
cannot silently query your running database. Run them with:

```powershell
cd backend
.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.venv\Scripts\python.exe -m pytest
```

Frontend component/controller/transport tests use mocked APIs. From `frontend`:

```powershell
npm test
npm run lint
npm run build
```

Real browser crypto tests run the actual WASM adapter in Chromium, Firefox and
WebKit and exchange encrypted messages with the matching official native
libsignal package. See `chat-encryption.md` for the isolated native peer installer
and three-browser commands. No backend or SQL is used by that harness.

For the actual React UI test, first start an isolated Vite server in
`frontend/apps/web` on port 4187 as described in the crypto document. In another
terminal there, run:

```powershell
npm run test:chat-ui
```

The UI runner installs interception before navigating either browser context.
Every application API/WebSocket is mocked; unknown API routes receive an error
and never fall through to the running backend. It exercises real browser crypto,
search, conversation creation, safety verification, emoji composition, literal
markup rendering, ciphertext-only transport, delivery/read state, reconnect,
reload and responsive width. Desktop/mobile screenshots are written under the
ignored `.tools/chat-ui` directory.

The same test passed against a built production preview with its CSP:

```powershell
# Terminal 1, frontend
npm run preview -w web -- --host 127.0.0.1 --port 4188 --strictPort
# Terminal 2, frontend/apps/web
$env:CHAT_UI_TEST_URL='http://127.0.0.1:4188'
npm run test:chat-ui
Remove-Item Env:CHAT_UI_TEST_URL
```

An additional test passed through the actual FastAPI chat routes and native
WebSockets, with no API interception. Its loopback-only relay uses the existing
JWT resolver and real chat services with an explicit in-memory repository and
connection guards. It recorded zero database connection attempts. Reproduction
uses `backend/tests/browser_relay.py` and
`frontend/apps/web/tests/chat-ui/relay-tests.mjs`; see `chat-api.md` for the
isolated ports and commands. Never point this test at the normal application
backend or expose its deliberately obtainable test-account tokens publicly.

No pre-existing automated regression suite was present. Existing monorepo
lint/build, database-free application/OpenAPI checks, new functional/security
tests and actual crypto/UI browser tests were executed. These do not replace
owner-run MSSQL and production deployment verification.

## Dependency audit and operational limits

The Python environment audit completed with no known vulnerabilities.
Targeted compatible frontend transitive updates removed the three high-severity
findings reported during installation. The final npm audit still reports
existing low/moderate advisories in the ESLint/shadcn tooling trees; the
production dependency graph includes the existing shadcn CLI package used for
its stylesheet. No forced major downgrade or unrelated dependency replacement
was applied. These findings remain an explicit dependency-maintenance item.

Single-worker delivery/presence/rate state is the supported initial deployment.
Multiple workers/hosts require a shared broker and distributed state. Browser
E2EE cannot protect compromised devices or malicious same-origin frontend code;
verification of first use must happen outside the relay. Revocation prevents
future server access and cannot erase previously decrypted content. Backups and
runtime SQL permissions must be restricted; runtime accounts need no DDL grants.
