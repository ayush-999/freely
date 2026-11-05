# Secure one-to-one chat: analysis and approval proposal

Reviewed: 4 November 2026. Approved by the owner; implemented 4–5 November 2026.
This document preserves the original review and proposal. Current implementation,
test results and activation steps are in `chat-rollout.md`, `chat-api.md`,
`chat-database.md` and `chat-encryption.md`.

The initial review changed no application code or SQL definitions and executed
no SQL. This document was the only source file added during that review. AGPL/GPL
dependencies are acceptable, as confirmed by the owner during this review.

## 1. Existing application and reusable integration points

| Area | Existing implementation | Integration approach |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, npm workspaces/Turborepo | Extend `frontend/apps/web`; keep the shared packages and application structure. |
| Routing/UI | Lazy React Router routes, protected routes, Messaging navigation placeholder | Add a protected messaging route and connect the existing navigation entry. |
| State/auth | Redux Toolkit auth slice, `useAuth`, JWT storage in `@workspace/auth` | Reuse authentication; keep private keys, ratchet state, and plaintext history outside Redux/devtools. |
| HTTP | Shared Axios client with bearer attachment and 401 handling | Add a typed chat service to the existing services directory. |
| User search | Existing identity service and `/api/v1/users/search`; public profiles expose handles | Create conversations and request public keys by handle; resolve existing user IDs inside the backend. |
| Design system | Shared buttons, inputs, textareas, cards, theme, avatars, date/error utilities | Reuse these components and the existing emoji picker/selection insertion utility. |
| Backend | FastAPI controllers -> services -> repositories -> SQLAlchemy models | Add a chat module using the same layers and existing router aggregation. |
| Identity | JWT subject identifies `users.id`; active-user resolution and bcrypt already exist | Reuse JWT validation and user lookup for REST and authenticated sockets. |
| Database | One SQLAlchemy engine/session factory, synchronous pyodbc, MSSQL | Reuse the engine, sessions, transactions, and parameterized ORM queries. |
| IDs/time | Secure random public identifiers; BIGINT relational keys; UTC `datetime2` | Follow existing conventions for new objects and API identifiers. |
| Deployment | Frontend Vite development server in Docker; FastAPI on the Windows host | Add WebSocket proxy support; document production HTTPS/WSS hosting separately. |

Key source locations include `backend/app/core/{security,database,config}.py`,
`backend/app/controllers/router.py`, `backend/app/services/base.py`,
`frontend/apps/web/src/{routes/index.tsx,services/api.ts,store/index.ts}`,
`frontend/apps/web/src/layouts/header.tsx`, and
`frontend/apps/web/src/components/emoji-picker.tsx`.

No chat, WebSocket, encrypted key store, shared realtime broker, rate limiter,
automated test suite, migration runner, production TLS proxy, or CI configuration
was found in the checked-in application.

## 2. Existing database review

Read in full: `backend/database/schema.sql`, `docs/freely.dbml`, and
`docs/DB Querys/querys.sql`. The latter combines reporting queries and historical
manual patches; it will remain separate from the new chat migration.

| Existing object | Count |
| --- | ---: |
| Tables / primary keys | 47 / 47 |
| Foreign keys | 104 |
| UNIQUE constraints | 16 |
| CHECK constraints | 46 |
| Named defaults | 107 |
| Explicit indexes | 100 |

No stored procedures, triggers, views, or functions are defined in these schema
sources. The DBML also defines 47 tables and 104 relationships. The final schema
status message says 45 tables and is stale; its count should be corrected when
the approved additions are made.

All 47 existing tables, their columns, relationships, indexes, constraints, and
seed rows can retain their definitions. No existing table requires alteration.
The unchanged tables are:

```text
users, organizations, organization_roles, organization_memberships,
departments, department_roles, department_memberships, platform_roles,
user_platform_roles, user_follows, posts, post_media, post_likes,
post_reposts, post_bookmarks, bookmark_collections, bookmark_collection_posts,
post_comments, comment_likes, hashtags, post_hashtags, post_mentions, post_views,
grievance_categories, grievances, grievance_attachments, post_grievance_links,
ai_assessments, grievance_assignments, grievance_status_history,
grievance_responses, sla_policies, grievance_sla, grievance_escalations,
notifications, grievance_feedback, audit_logs, job_postings,
government_job_details, job_receipts, candidate_profiles, job_applications,
job_application_status_history, job_application_decisions,
government_application_results, job_decision_acknowledgements, saved_jobs
```

Reuse `users.id bigint`. Do not reuse existing notification, grievance-response,
post, or recruitment message fields as chat storage. Their existing plaintext
content belongs to other workflows. Chat notifications may contain generic
alerts and metadata, with no decrypted text or previews.

## 3. Proposed minimum database additions

Five new tables are sufficient for the initial one-to-one feature. Names follow
the current snake_case and `PK_`, `FK_`, `UQ_`, `CK_`, `DF_`, `IX_` conventions.
All new timestamps use UTC `datetime2`. Public IDs use the existing secure-ID
helper; internal relationships continue to use BIGINT keys.

| New table | Proposed contents and constraints |
| --- | --- |
| `chat_conversations` | Identity PK, secure public ID, canonical `participant_low_user_id` / `participant_high_user_id`, creation/update timestamps. Two FKs to users, CHECK low < high, UNIQUE pair, UNIQUE public ID. The pair is immutable and has exactly two distinct members. |
| `chat_devices` | Identity PK, secure public ID, existing user FK, per-user Signal device number, registration ID, protocol version, identity **public** key, optional device label, created/last-seen/revoked timestamps. Unique public ID and `(user_id, device_id)`; composite owner/row uniqueness supports device-owner FKs. Device numbers are not recycled while old envelopes or sessions may refer to them. |
| `chat_prekeys` | Device FK, protocol version, key kind and key ID, public key, public signature where required, created/expiry/retirement/claim timestamps. Unique device/kind/key ID. Distinguish EC signed, EC one-time, KEM one-time, and reusable KEM last-resort keys if the validated Signal implementation requires them. Never upload serialized private prekey records. |
| `chat_messages` | Identity PK, secure public ID, conversation FK, sender user/device, client-generated UUID, request digest, server acceptance timestamp. Composite device-owner FK and unique sender-device/client UUID enforce idempotency. Contains metadata only. |
| `chat_message_envelopes` | Identity PK, message FK, destination user/device, protocol version/type, bounded nonempty `varbinary(max)` ciphertext, created/delivered/read timestamps. Composite destination-device-owner FK; unique message/destination device; CHECK read implies delivered. |

No separate group membership, receipt, presence, or outbox table is proposed.
Each envelope has its own device delivery/read state. User-facing status is
aggregated only from the other participant's devices, not the sender's sync
devices. Read means the recipient explicitly acknowledged viewing the message.

The conversation CHECK/UNIQUE constraints enforce the canonical two-user pair.
The service also checks, inside the transaction, that sender and destination
users belong to that pair. The five-table design does **not** claim that a SQL
foreign key alone enforces this cross-table either-participant rule.

Indexes will cover both participant conversation lists, active devices,
available prekeys, conversation history, and pending envelopes per device.
Public key/signature size limits and protocol enum values must be finalized
against the validated adapter rather than guessed from legacy Signal formats.

One-time key claims must atomically select and mark public keys in one MSSQL
transaction using parameterized statements and `UPDATE ... OUTPUT`/appropriate
locking. Concurrent claims, exhaustion, and configured isolation semantics must
be tested. Reusable last-resort KEM keys must not be consumed as one-time keys.

## 4. Encryption implementation decision and prerequisite

Signal remains the preferred protocol. Browser compatibility is a material
integration constraint:

| Implementation reviewed | Finding | Decision |
| --- | --- | --- |
| Official `@signalapp/libsignal-client` | The TypeScript package uses native Node libraries. The project is AGPLv3, does not support external use, and warns APIs may change without notice. | Do not import it directly into Vite as a browser library. It may serve as an isolated interoperability test peer. |
| Official `libsignal-protocol-javascript` | Archived in 2021 and explicitly unmaintained. | Do not adopt. |
| `@privacyresearch/libsignal-protocol-typescript` | Browser WebCrypto support is documented; source manifest is version 0.0.16 and GPL-3.0-only, based on the old JS implementation. | Not selected without stronger maintenance, compatibility, and security evidence. |
| `@getmaapp/signal-wasm` | Third-party browser WASM bridge, source version 0.6.6, AGPL-3.0-only, pinned upstream Rust libsignal. Supports serialized sessions/prekeys and Kyber replay-state exports. | Evaluation candidate only; unmodified adoption has a concrete identity-storage blocker. |

Source inspection of the WASM candidate shows that its public identity-store
API exposes only construction, without trusted remote identity import/export
or explicit trust management. Its upstream in-memory store starts with no
trusted contacts. Restoring sessions after reload therefore does not also
restore remote identity pins. External fingerprint display alone does not fix
authenticated inbound key checking.

Before integration, prove a library-backed storage binding that persists and
restores contact identity pins, verification state, sessions, consumed prekey
tombstones, and replay protection. A minimal reviewed WASM storage-binding
extension over pinned libsignal is within the proposed evaluation scope;
cryptographic algorithms and wire protocol must remain library implementations.
Pin the exact artifact and source revision, verify correspondence, and test
release builds in Chromium, Firefox, and WebKit. Do not add custom cryptography
or silently substitute a different protocol if this cannot be made sound.

Mandatory acceptance evidence includes bidirectional browser/native
interoperability, identity-change rejection across reload, invalid signature
rejection, out-of-order messages, duplicate/replay rejection across restart,
prekey exhaustion/rotation, device revocation, and forward secrecy / recovery
after a fresh honest ratchet following simulated session-state compromise.
No encryption, decryption, verification, or interoperability tests have run yet.
The candidate's own security report is not independent validation of this app.

References checked during this review:

- [Official libsignal support, APIs, native packages and license](https://github.com/signalapp/libsignal)
- [Archived official JavaScript implementation](https://github.com/signalapp/libsignal-protocol-javascript)
- [Privacy Research source and browser defaults](https://github.com/privacyresearchgroup/libsignal-protocol-typescript)
- [Privacy Research package manifest](https://raw.githubusercontent.com/privacyresearchgroup/libsignal-protocol-typescript/master/package.json)
- [WASM candidate API and browser build](https://github.com/getmaapp/signal-wasm)
- [WASM candidate source pin and license](https://raw.githubusercontent.com/getmaapp/signal-wasm/main/Cargo.toml)
- [WASM candidate identity-store implementation](https://raw.githubusercontent.com/getmaapp/signal-wasm/main/src/lib.rs)
- [Pinned upstream in-memory trust store](https://raw.githubusercontent.com/signalapp/libsignal/b056faa6dd02961cff24064c54c089c52e1a0753/rust/protocol/src/storage/inmem.rs)
- [Signal Double Ratchet specification](https://signal.org/docs/specifications/doubleratchet/)
- [Signal multi-device session management](https://signal.org/docs/specifications/sesame/)

## 5. Client key lifecycle and history

Keep encryption in an isolated adapter/store, preferably a worker. Use
account/device-scoped IndexedDB storage with standard WebCrypto protection for
serialized secret records; do not put private keys in localStorage, Redux,
logs, API DTOs, notifications, or the server. A nonextractable wrapping key does
not prevent malicious same-origin code from using it. Browser E2EE cannot
protect a compromised device or malicious frontend deployment.

Atomically persist ratchet changes with the encrypted outgoing queue before
transmission. Retry the original ciphertext and client UUID. For reception,
atomically persist protocol state, replay/tombstone state and the encrypted
local history record before delivery acknowledgement. Serialize operations
across tabs and handle failed writes/crashes without reusing old ratchet state.

Verification uses library fingerprints/safety numbers and an out-of-band peer
comparison. First use is visibly unverified. Identity changes or added devices
must interrupt sending and require explicit trust approval; no silent key
replacement. Persist approved identity pins across reload. Rotate signed
prekeys with overlap for delayed messages; replenish one-time prekeys. Revoke
devices server-side and close their sockets; revocation cannot erase content
already decrypted on those devices.

Forward secrecy requires discarding consumed message keys. Historical rendering
therefore uses a separate device-local encrypted archive, rather than retaining
old ratchet keys. The original sender also stores its sent history locally.
Fan out fresh ciphertext to each authorized destination device, including the
sender's other trusted devices. Newly added devices cannot automatically decrypt
old device envelopes. Secure history transfer/recovery is a later explicit
feature; losing browser key/archive storage can make old history unavailable.
Logout/account switching closes connections, clears plaintext memory and locks
device storage; deleting local keys is an explicit destructive device action.

## 6. Backend REST and WebSocket proposal

All routes use the existing `/api/v1` prefix, JWT validation, active-user
resolution, validation/error conventions, DB sessions, and service transactions.
The following suffixes are proposed under `/chat`:

| Route | Purpose |
| --- | --- |
| `GET/POST /conversations` | List owned conversations; create/reuse a canonical pair by recipient handle. |
| `GET /conversations/{public_id}` | Membership-checked conversation metadata. |
| `GET /conversations/{public_id}/messages` | Paginated encrypted history restricted to the authenticated destination device. |
| `POST /messages` | Atomically accept metadata and per-device encrypted envelopes; return committed acknowledgement. |
| `GET /devices/{public_id}/pending` | Recover unacknowledged envelopes on reconnect and periodically while connected. |
| `POST /messages/{public_id}/receipts` | Idempotent, monotonic delivered/read updates for the caller's destination device. |
| `GET/POST /devices` | List/register the caller's devices and public credentials. |
| `POST /devices/{public_id}/revoke` | Revoke an owned device without deleting historical metadata. |
| `POST /keys/upload` | Upload the caller's public key material only. |
| `GET /keys/{handle}` | Read permitted active public device/key metadata without consuming a prekey. |
| `POST /keys/{handle}/claim` | Atomically claim per-device session-establishment public prekeys. |
| `WS /ws` | Authenticated realtime events for the same user/device and conversation rules. |

Authenticate sockets through a short timed first frame over WSS using the
existing JWT resolver, with bounded unauthenticated connections. Do not put JWTs
in URLs. Check Origin independently of CORS, expire connections with their JWT,
and recheck membership, active user and device validity for every operation.
Use short per-operation SQLAlchemy sessions off the async event loop because
the existing pyodbc access is synchronous.

Support `message.send`, `message.receive`, `message.delivered`, `message.read`,
`typing.start`, `typing.stop`, `user.online`, and `user.offline`, plus explicit
authentication/error/commit acknowledgements. Both REST and socket sends call
the same service. Validate event schemas, frame sizes, encoding, batch sizes,
connection limits, and per-user/device event rates. Typing expires automatically;
presence aggregates multiple connections and is visible only to authorized peers.

Broadcast only after commit. A lost broadcast is recovered through a pending
envelope pull. Do not depend only on a monotonically increasing IDENTITY cursor:
concurrent transactions can commit IDs out of order. Poll unacknowledged
envelopes with bounded paging/reconciliation and deduplicate durably on clients.
Repeated client UUIDs with different content fail rather than altering an
accepted message. Server acceptance means sent; a socket write is not delivery.

The current single-process deployment can use an in-process connection hub,
presence, and limiter. Enforce/document one worker for that mode. A deployment
with multiple workers or instances requires shared pub/sub, presence and rate
state before activation; no horizontally safe claim for process-local state.

## 7. Frontend and deployment changes

Provide a responsive conversation/search pane and chat window, encrypted local
history, text composer, existing emoji picker, timestamps, delivery/read state,
typing/presence, reconnect state, verification and device controls. Render
decrypted content as React text nodes. Disable sending on trust failures or
encryption/storage initialization failures. Keep plaintext previews out of
generic notifications and persisted Redux state.

Add WebSocket forwarding to the existing Vite `/api` proxy. Introduce explicit
chat enablement settings, disabled until the manual migration and crypto checks
are complete. A missing migration should produce a chat-specific readiness
failure, without preventing unrelated application routes from starting. Never
auto-create tables or run migrations at startup.

Production requires HTTPS/WSS and frontend document security headers at the
actual frontend host. A CSP header on API responses does not secure a separately
served frontend. Establish a strict policy for bundled scripts, the exact
API/socket origins, workers and WASM; avoid general script `unsafe-eval`.
The existing theme provider dynamically inserts a style element, so preserve
theme behavior with an allowed static class or appropriately scoped policy.
Audit inline styles and existing media/font usage before enforcing a policy.

Use redacted/metadata-only chat logging and SQL parameter hiding where debug
echo could expose data. Keep secrets out of Vite environment variables. Document
restricted DB runtime grants, migration-only DDL permissions, protected encrypted
backups, strong production JWT secrets, validated DB certificates, and dependency
audits. Preserve the current login/token behavior as requested.

## 8. Planned file changes after approval

| Files | Reason |
| --- | --- |
| `backend/database/schema.sql` | Append only the approved chat DDL before seed/commit sections; preserve original definitions and seeds. |
| `docs/freely.dbml` | Add matching chat tables/relationships because the repository identifies DBML as its design source. |
| `backend/database/migrations/001_chat_up.sql` | Exact standalone, documented manual MSSQL upgrade. |
| `backend/database/migrations/001_chat_down.sql` | Guarded rollback in reverse dependency order. |
| New `backend/app/{models,schemas}/chat.py` | ORM and strictly ciphertext/public-key request/response types. |
| New `backend/app/repositories/chat_repository.py` | Parameterized persistence, claims, history and pending delivery. |
| New `backend/app/services/chat_service.py` | Authorization, idempotency, transactions, receipts and devices. |
| New `backend/app/controllers/chat_controller.py` | REST/socket routes following existing conventions. |
| New `backend/app/core/chat_realtime.py` | Connection lifecycle, presence, typing, bounds and limits. |
| `backend/app/controllers/router.py`, `backend/app/models/__init__.py` | Register the new module/models. |
| `backend/app/core/{security,config,database}.py`, `backend/app/main.py`, `backend/.env.example` | Reuse the token resolver, add feature/settings/lifecycle and safe logging without changing existing auth semantics. |
| `backend/requirements.txt` and new test dependency file | Only justified transport dependencies; isolate test tools. |
| New frontend `src/pages/chat/*`, `src/components/chat/*` | Chat, identity verification and device-management views. |
| New frontend `src/services/{chat.service,chat-realtime}.ts`, `src/hooks/use-chat.ts`, `src/types/chat.ts` | Typed REST/realtime integration and lifecycle. |
| New frontend `src/crypto/*` and `src/store/chat-slice.ts` | Isolated protocol/vault handling and nonsecret chat state. A reviewed WASM binding package is conditional on feasibility. |
| Frontend route/API constants, router, header, store/provider lifecycle, Vite config, theme provider as needed | Connect messaging, cleanup on auth changes, proxy sockets, and preserve behavior under CSP. |
| Frontend package manifests/lockfile and test configuration | Pin the approved crypto artifact and add meaningful browser/component tests. |
| Backend/frontend test directories, run documentation and new chat documentation | Functional/security/interoperability evidence, API/events, migration and deployment instructions. |

The completed implementation will document every modified file and its purpose.
No original component or route needs removal.

## 9. Manual migration and rollback delivery

After approval and adapter-format validation, prepare the schema update and
exact executable upgrade/rollback scripts. Do not execute either script.

Upgrade order: preflight expected `dbo.users` shape and conflicting objects;
create conversations/devices; prekeys; messages; envelopes; supporting indexes;
validate constraints; commit. Use `SET XACT_ABORT ON`, explicit `dbo` names and
TRY/CATCH transaction handling. Stop on incompatible existing objects rather
than blindly skipping them. Preserve all existing seeds and objects.

The owner backs up the database, reviews and runs the standalone upgrade in
SSMS/sqlcmd, confirms success, and then enables chat. The complete `schema.sql`
is for empty database creation and must not be reapplied to the running database.
Code and documentation must not assume the database was updated by editing DDL.

Rollback disables chat first. The script drops envelopes, messages, prekeys,
then devices/conversations only when all added tables are empty; otherwise it
refuses data loss. Once used, the safe rollback is to disable the feature and
retain encrypted tables. Any later destructive removal needs a backup and an
explicit decision to discard chat history/metadata.

## 10. Verification and sequence

Baseline checks actually executed during this review:

| Check | Result and scope |
| --- | --- |
| `npm.cmd run lint` in `frontend` | Exit 0. Web ESLint executed; shared UI lint replayed an existing Turbo cache result. |
| `npm.cmd run build` in `frontend` | Exit 0. Fresh `tsc -b && vite build`. |
| Python AST parsing | All 67 backend Python source files parsed successfully without app imports or DB access. This is syntax validation, not runtime testing. |
| Git status before this document | Clean after baseline commands. |

No automated application tests were present. `pytest` and `httpx` were absent
from the backend virtual environment. No chat or cryptographic tests exist yet.
No DB connection, health/database probe, migration, or SQL query was executed.

After implementation, execute isolated backend auth/membership/device tests,
transaction/idempotency/receipt tests, validated WebSocket events and reconnect
tests; frontend rendering/composition/emoji/reception/reconnect tests; and real
browser crypto/interoperability/security tests described above. Include account
switching, revoked devices, cross-tab races, storage failure, tampered ciphertext,
injected text, missing migration, and regression checks for existing routes.
Use dependency overrides/fakes for backend tests so they cannot reach the
configured database. MSSQL integration/locking/migration execution remains a
documented owner-run check unless separately authorized against a disposable
database; never report it as passed based on mocks or source inspection.

Implementation sequence after owner approval:

1. Resolve the browser Signal storage/API feasibility prerequisite and prove its
   identity/replay persistence and bidirectional interoperability.
2. Finalize public-key formats and the additive schema, manual migration and
   guarded rollback; keep feature activation off.
3. Implement the existing-backend chat module and realtime transport.
4. Integrate the validated client crypto/vault lifecycle, then the existing-app
   chat UI and session cleanup.
5. Run functional, crypto, security and existing build/lint checks; report actual
   outcomes and any owner-run MSSQL checks still pending.
6. Deliver file-by-file changes, API/event/crypto/database documentation, manual
   migration steps and application/deployment run instructions.

Approval is required before significant application or schema changes. Approval
of this proposal authorizes the stated implementation work and storage-binding
evaluation; it does not mean the crypto candidate has passed tests or that chat
is ready to enable in production.
