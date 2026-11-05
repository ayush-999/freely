# Chat integration file-by-file changes

All listed changes belong to the approved messaging integration. Existing database
table definitions and unrelated routes/components were retained. No SQL was executed.

| File | What changed and why |
| --- | --- |
| [.gitignore](../.gitignore) | Ignore local crypto test tools, browser reports and Python test caches. |
| [backend/.env.example](../backend/.env.example) | Document opt-in chat readiness, single-worker and socket settings without changing existing secrets. |
| [backend/README.md](../backend/README.md) | Link chat activation, manual migration and API/event instructions. |
| [backend/app/controllers/chat_controller.py](../backend/app/controllers/chat_controller.py) | Expose gated REST and timed first-frame authenticated WebSockets with redacted errors. |
| [backend/app/controllers/router.py](../backend/app/controllers/router.py) | Register the additive chat router under the existing API prefix. |
| [backend/app/core/chat_realtime.py](../backend/app/core/chat_realtime.py) | Provide bounded single-process delivery queues, authorized presence/typing and rate limiting. |
| [backend/app/core/config.py](../backend/app/core/config.py) | Add disabled-by-default chat readiness, origin and resource-limit settings. |
| [backend/app/core/database.py](../backend/app/core/database.py) | Hide bound SQL parameters in existing engine debug logging. |
| [backend/app/core/security.py](../backend/app/core/security.py) | Expose the existing JWT/active-user resolver for authenticated sockets while preserving REST auth. |
| [backend/app/main.py](../backend/app/main.py) | Validate chat runtime settings without startup database access. |
| [backend/app/models/__init__.py](../backend/app/models/__init__.py) | Register the five new ORM models with the existing shared Base. |
| [backend/app/models/chat.py](../backend/app/models/chat.py) | Define five MSSQL-compatible ciphertext/public-key/metadata models and constraints. |
| [backend/app/repositories/chat_repository.py](../backend/app/repositories/chat_repository.py) | Reuse the existing SQLAlchemy session for parameterized data access and atomic key claims. |
| [backend/app/schemas/chat.py](../backend/app/schemas/chat.py) | Validate bounded ciphertext/public-key-only DTOs and reject unexpected fields. |
| [backend/app/services/chat_service.py](../backend/app/services/chat_service.py) | Enforce membership/device ownership, fanout, key lifecycle, deduplication, history and explicit receipts. |
| [backend/database/migrations/001_chat_down.sql](../backend/database/migrations/001_chat_down.sql) | Supply reverse-order rollback that refuses to discard chat data. |
| [backend/database/migrations/001_chat_up.sql](../backend/database/migrations/001_chat_up.sql) | Supply a standalone transactional, shape-checked manual MSSQL upgrade. |
| [backend/database/schema.sql](../backend/database/schema.sql) | Append only five chat definitions, preserving all original tables/seeds and correcting the final count. |
| [backend/pytest.ini](../backend/pytest.ini) | Locate the database-free test suite and its application imports. |
| [backend/requirements-test.txt](../backend/requirements-test.txt) | Pin isolated backend test dependencies; runtime dependency list is unchanged. |
| [backend/run.py](../backend/run.py) | Bound inbound WebSocket transport frames/queues in the existing launcher. |
| [backend/tests/__init__.py](../backend/tests/__init__.py) | Mark the test helpers as an importable test package. |
| [backend/tests/chat_fakes.py](../backend/tests/chat_fakes.py) | Provide explicit in-memory repository/session doubles for backend tests. |
| [backend/tests/conftest.py](../backend/tests/conftest.py) | Forbid all SQL connections and set isolated test environment defaults. |
| [backend/tests/test_chat.py](../backend/tests/test_chat.py) | Exercise real HTTP/WebSocket adapters plus service authorization, keys, receipts and retry invariants. |
| [backend/tests/test_chat_schema.py](../backend/tests/test_chat_schema.py) | Verify schema/ORM contracts and preservation of original definitions without running SQL. |
| [docs/chat-api.md](../docs/chat-api.md) | Document API payloads, authentication, WebSocket events, rate limits and activation. |
| [docs/chat-changes.md](../docs/chat-changes.md) | Provide this complete file-by-file change manifest. |
| [docs/chat-database.md](../docs/chat-database.md) | Explain unchanged objects, new constraints/indexes, manual execution and rollback. |
| [docs/chat-encryption.md](../docs/chat-encryption.md) | Explain pinned protocol implementation, trust hydration, vault lifecycle, retention, limits and real crypto tests. |
| [docs/chat-integration-plan.md](../docs/chat-integration-plan.md) | Preserve the completed initial analysis, owner approval and implementation scope. |
| [docs/chat-rollout.md](../docs/chat-rollout.md) | Provide consolidated database execution, application run, deployment and test instructions. |
| [docs/chat-test-results.md](../docs/chat-test-results.md) | Record executed checks separately from unexecuted MSSQL/deployment verification. |
| [docs/freely.dbml](../docs/freely.dbml) | Extend the existing database design additively with the same five tables/relationships. |
| [frontend/apps/web/package.json](../frontend/apps/web/package.json) | Pin Signal WASM and test tools; add component/browser test commands. |
| [frontend/apps/web/public/licenses/README.txt](../frontend/apps/web/public/licenses/README.txt) | Preserve distributed crypto dependency license notices, the full upstream AGPL text and corresponding-source references. |
| [frontend/apps/web/public/licenses/libsignal-AGPL-3.0.txt](../frontend/apps/web/public/licenses/libsignal-AGPL-3.0.txt) | Preserve distributed crypto dependency license notices, the full upstream AGPL text and corresponding-source references. |
| [frontend/apps/web/public/licenses/signal-wasm.txt](../frontend/apps/web/public/licenses/signal-wasm.txt) | Preserve distributed crypto dependency license notices, the full upstream AGPL text and corresponding-source references. |
| [frontend/apps/web/src/components/chat/device-verification.tsx](../frontend/apps/web/src/components/chat/device-verification.tsx) | Require explicit matching safety-number verification for destination devices. |
| [frontend/apps/web/src/components/chat/message-composer.tsx](../frontend/apps/web/src/components/chat/message-composer.tsx) | Reuse shared textarea/button/emoji picker and preserve drafts when sending is rejected. |
| [frontend/apps/web/src/components/theme-provider.tsx](../frontend/apps/web/src/components/theme-provider.tsx) | Use a static theme-transition class instead of injecting a style element under CSP. |
| [frontend/apps/web/src/crypto/encoding.ts](../frontend/apps/web/src/crypto/encoding.ts) | Provide strict base64/byte conversion helpers; no cryptographic algorithm. |
| [frontend/apps/web/src/crypto/index.ts](../frontend/apps/web/src/crypto/index.ts) | Expose the isolated, typed chat crypto/vault API. |
| [frontend/apps/web/src/crypto/signal-engine.ts](../frontend/apps/web/src/crypto/signal-engine.ts) | Adapt pinned libsignal operations to persisted state and restore identity pins using library APIs. |
| [frontend/apps/web/src/crypto/types.ts](../frontend/apps/web/src/crypto/types.ts) | Define public bundles and local-only encrypted vault/session/archive contracts. |
| [frontend/apps/web/src/crypto/vault.ts](../frontend/apps/web/src/crypto/vault.ts) | Protect account-scoped IndexedDB state with WebCrypto/Web Locks and atomically persist ratchets, replay state, archive and outbox. |
| [frontend/apps/web/src/hooks/use-chat.ts](../frontend/apps/web/src/hooks/use-chat.ts) | Bind the controller lifecycle to the authenticated account/page. |
| [frontend/apps/web/src/layouts/header.tsx](../frontend/apps/web/src/layouts/header.tsx) | Connect the existing Messaging navigation entry to the protected chat route. |
| [frontend/apps/web/src/pages/chat/chat-page.tsx](../frontend/apps/web/src/pages/chat/chat-page.tsx) | Integrate responsive search/conversations/history/status/device management into the existing app. |
| [frontend/apps/web/src/routes/index.tsx](../frontend/apps/web/src/routes/index.tsx) | Add a lazy protected messaging page without removing existing routes. |
| [frontend/apps/web/src/services/api.ts](../frontend/apps/web/src/services/api.ts) | Preserve a chat request's captured account token and prevent an old account's 401 from clearing a newer login. |
| [frontend/apps/web/src/services/chat-controller.ts](../frontend/apps/web/src/services/chat-controller.ts) | Coordinate encrypted queues, delivery recovery, device verification, receipts and transient page state. |
| [frontend/apps/web/src/services/chat-realtime.ts](../frontend/apps/web/src/services/chat-realtime.ts) | Authenticate browser sockets without URL tokens; reconnect with backoff and clean up on logout. |
| [frontend/apps/web/src/services/chat.service.ts](../frontend/apps/web/src/services/chat.service.ts) | Reuse shared Axios for typed, account-bound and abortable chat REST requests. |
| [frontend/apps/web/src/types/chat.ts](../frontend/apps/web/src/types/chat.ts) | Mirror backend chat DTOs and adapt public key bundles to the isolated crypto interface. |
| [frontend/apps/web/tests/chat-ui/browser-tests.mjs](../frontend/apps/web/tests/chat-ui/browser-tests.mjs) | Exercise the real React UI and real Signal crypto with all APIs/WebSockets intercepted before navigation. |
| [frontend/apps/web/tests/crypto/browser-tests.mjs](../frontend/apps/web/tests/crypto/browser-tests.mjs) | Run real three-browser protocol/vault security tests and official native interoperability. |
| [frontend/apps/web/tests/crypto/harness.html](../frontend/apps/web/tests/crypto/harness.html) | Load only browser crypto modules, without any backend application calls. |
| [frontend/apps/web/tests/crypto/install-native-peer.mjs](../frontend/apps/web/tests/crypto/install-native-peer.mjs) | Reproduce the isolated native peer installation without adding it to browser dependencies. |
| [frontend/apps/web/tests/crypto/native-peer/package-lock.json](../frontend/apps/web/tests/crypto/native-peer/package-lock.json) | Pin the independent official native libsignal interoperability peer for installation under ignored local test tools. |
| [frontend/apps/web/tests/crypto/native-peer/package.json](../frontend/apps/web/tests/crypto/native-peer/package.json) | Pin the independent official native libsignal interoperability peer for installation under ignored local test tools. |
| [frontend/apps/web/tests/unit/chat-controller.test.ts](../frontend/apps/web/tests/unit/chat-controller.test.ts) | Test account cleanup, encrypted retries, reconnect receipts, pending pagination and revocation. |
| [frontend/apps/web/tests/unit/chat-realtime.test.ts](../frontend/apps/web/tests/unit/chat-realtime.test.ts) | Test first-frame auth, secure socket URLs, reconnect and rejected sessions. |
| [frontend/apps/web/tests/unit/message-composer.test.tsx](../frontend/apps/web/tests/unit/message-composer.test.tsx) | Test Unicode/emoji composition, drafts, verification gating and safe draft text. |
| [frontend/apps/web/tests/unit/setup.ts](../frontend/apps/web/tests/unit/setup.ts) | Initialize component assertions and cleanup. |
| [frontend/apps/web/vite.config.ts](../frontend/apps/web/vite.config.ts) | Forward WebSocket upgrades and emit a strict production document CSP with WASM support. |
| [frontend/apps/web/vitest.config.ts](../frontend/apps/web/vitest.config.ts) | Configure isolated jsdom component/controller/transport tests. |
| [frontend/deploy/nginx.conf.example](../frontend/deploy/nginx.conf.example) | Provide an optional HTTPS/WSS production edge example without changing the development deployment. |
| [frontend/package-lock.json](../frontend/package-lock.json) | Lock the exact browser crypto/testing artifacts and compatible security patches to four existing transitive packages. |
| [frontend/package.json](../frontend/package.json) | Add the frontend test command while preserving the workspace tooling. |
| [frontend/packages/constants/src/api-endpoints.ts](../frontend/packages/constants/src/api-endpoints.ts) | Add chat endpoint builders to existing shared API constants. |
| [frontend/packages/constants/src/routes.ts](../frontend/packages/constants/src/routes.ts) | Add the messaging route to existing shared constants. |
| [frontend/packages/ui/src/styles/globals.css](../frontend/packages/ui/src/styles/globals.css) | Add the static theme-transition rule needed by the strict document CSP. |
| [backend/tests/parse_chat_sql.ps1](../backend/tests/parse_chat_sql.ps1) | Parse the full schema and both migrations offline with Microsoft ScriptDom, without a SQL client or connection. |
| [backend/tests/browser_relay.py](../backend/tests/browser_relay.py) | Provide a loopback-only real FastAPI/JWT/WebSocket relay with explicit fake persistence and forbidden database connections for browser integration tests. |
| [frontend/apps/web/tests/chat-ui/relay-tests.mjs](../frontend/apps/web/tests/chat-ui/relay-tests.mjs) | Exercise real React, Signal encryption and actual FastAPI/native WebSockets against only the isolated in-memory test relay, without API interception. |
