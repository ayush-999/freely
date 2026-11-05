# Chat integration verification results

Executed on 4–5 November 2026. Results below describe checks actually run.
No SQL script/query or database connectivity probe was executed. The real
database was not connected, inspected, migrated or modified.

| Check | Actual result | Evidence scope |
| --- | --- | --- |
| Existing frontend monorepo `npm run lint` | Passed; web lint ran after final source changes, shared UI lint ran freshly during integration and used its unchanged cache in the last run | Existing and new frontend source. |
| Existing frontend monorepo `npm run build` | Passed; fresh TypeScript/Vite production build | Existing routes plus chat and bundled WASM/CSP. |
| Frontend `npm test` | 15 tests passed in three files | Composer/emoji/draft gating, authenticated transport/reconnect and mocked controller recovery/account lifecycle. |
| Backend `python -m pytest` | 38 tests passed, including five schema contract tests and ten schema subcases | Real HTTP/WebSocket adapters and services with an explicit in-memory repository; connections forbidden by fixtures. |
| Browser crypto: Chromium, Firefox 157, WebKit 27.2 | Passed in all three | Actual WASM encryption/decryption, identity verification, persisted trust/replay/history, tampering, out-of-order messages, storage-write failure, rotation and ratchet behavior. |
| Official native interoperability | Passed bidirectionally in all three browsers | Browser WASM exchanged ciphertext with official `@signalapp/libsignal-client@0.101.0`, isolated from browser runtime dependencies. |
| Real React UI with intercepted HTTP/WebSockets | Passed on development and built production preview | Two browser contexts, actual crypto, search/conversation/verification, emoji and literal markup, ciphertext-only transport, receipts, reconnect/reload and mobile width. |
| Real React UI through actual FastAPI/native WebSockets | Passed without API/socket interception | Isolated loopback relay used real chat DTOs, services, existing JWT validation and actual sockets with an explicit fake repository. Two encrypted messages/envelopes accepted, zero database connection attempts, no API/page errors. |
| Production document CSP | Production-preview UI flow passed | Actual built app and WASM operated with the emitted CSP; the theme uses a static transition rule. |
| Microsoft ScriptDom SQL Server 2019 syntax parsing | All three SQL files passed offline | Updated full schema, standalone upgrade and rollback parsed using Microsoft's ScriptDom 180.140.0 `TSql150Parser`. Parsing does not execute SQL or establish runtime semantics. |
| DBML compilation | Passed | Existing design plus additive chat compiled to MSSQL text only. |
| Original schema preservation | Passed | All 47 original table definition bodies and 100 explicit index statements remained identical; full schema now defines 52 tables. |
| Python dependency audit | Passed: no known vulnerabilities reported | Installed backend/runtime/test environment, `pip-audit 2.10.1`. |
| Frontend dependency audit | Remaining findings documented | Compatible patches removed all three high-severity findings. Final full graph: 15 low/moderate advisories; production graph: six low/moderate findings associated with the existing shadcn/tooling tree. |

The backend run emitted one installed Starlette/httpx deprecation warning; tests
passed. Launching the optional PowerShell SQL-parser script directly was blocked
by this machine's script-execution policy. The equivalent inline ScriptDom
parser successfully validated all three files without changing that policy.

No pre-existing automated regression suite was present. The existing full
frontend lint/build were run alongside the new backend/frontend/security tests.
OpenAPI generation and bound MSSQL query compilation were also checked offline.

Real browser security cases include:

- Sending rejected before explicit matching safety-number verification;
  identity changes and replay rejected after vault reopening.
- Ciphertext corruption and authenticated conversation/device substitution
  rejected without committing draft ratchet state; valid retry succeeds.
- Outbox retry reuses the same ciphertext/client UUID; definitive stale-roster
  rejection may create new ciphertext/new UUID without duplicating local history.
- Failed IndexedDB commit does not expose a sendable envelope or advance durable
  protocol state. Web Locks serialize account-scoped browser operations.
- Past consumed ciphertext rejected by current protocol state, and captured old
  receiver state unable to decrypt after fresh honest ratchet exchanges. These
  are behavioral checks rather than a new formal cryptographic proof.
- Signed-prekey rotation, server-count-driven replenishment and delayed private
  key overlap; closed vault and account isolation guards.

MSSQL migration execution, rollback execution, catalog-expression verification
on a live server, real lock contention/isolation behavior, DB permissions,
backups, production TLS/proxy deployment and horizontal scaling were **not**
tested. They remain documented owner-run activation checks. Fake repositories,
syntax parsing and successful encryption do not establish those results.

Reproduction commands and supported deployment limits are in
[chat-rollout.md](chat-rollout.md), [chat-api.md](chat-api.md),
[chat-encryption.md](chat-encryption.md) and [chat-database.md](chat-database.md).
