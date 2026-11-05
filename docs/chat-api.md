# Encrypted chat API and realtime events

Chat extends the existing FastAPI backend at `/api/v1/chat`. Authentication is
the existing bearer JWT and active `users.id`; no second account system or DB
connection is introduced. Runtime data access uses the existing SQLAlchemy
session. This implementation contains no migration runner or startup DDL.

## Activation and deployment

All three flags default to false:

```dotenv
CHAT_ENABLED=false
CHAT_SCHEMA_READY=false
CHAT_CRYPTO_READY=false
CHAT_WORKER_COUNT=1
```

The owner first reviews and manually executes `database/migrations/001_chat_up.sql`
against the existing MSSQL database, verifies it, and validates the pinned browser
crypto release. Set the readiness flags and enable chat only after those steps.
Editing `schema.sql` does not update the running database. No SQL was executed
while implementing or testing this module.

`GET /config` is DB-free and reports `{enabled, protocol_version,
max_ciphertext_bytes, max_devices_per_user}`. Other chat endpoints return 503
while disabled/not marked ready. Storage failures produce a redacted chat-only
503; they do not cause unrelated routes to query the new tables at startup.

The connection hub, presence and rate limiter are process-local. Run one API
worker/instance. `CHAT_WORKER_COUNT` and `WEB_CONCURRENCY` are checked, but an
external process manager must not start additional instances with inconsistent
settings. Multiple workers/hosts require shared pub/sub, presence and rate state
before activation. They are not supported by this initial configuration.

Use `python run.py` for the current Windows-host backend. The launcher bounds
WebSocket frames and inbound queues. An equivalent direct command is:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --ws-max-size 2097152 --ws-max-queue 4
```

Production must terminate HTTPS/WSS at the application/reverse proxy and forward
the WebSocket upgrade. Configure trusted proxy handling so the ASGI request has
the correct secure scheme; do not trust arbitrary forwarded headers. Configure
an explicit `CHAT_ALLOWED_ORIGINS` list (empty reuses CORS origins). Sockets check
Origin separately from CORS and reject wildcard/unlisted origins. Development
allows HTTP only on named loopback/test hosts when explicitly permitted; that
exception is disabled outside `APP_ENV=development`.

Use a strong explicit production JWT secret, restricted runtime SQL permissions
on chat tables (no DDL), validated DB TLS certificates and protected backups.
Private keys and decrypted content never belong in server environments or logs.
SQLAlchemy now hides bound parameters even when existing debug SQL echo is on.

## Payload conventions

All binary fields use canonical standard base64 with padding. Only public key
bytes/signatures are accepted by key APIs. Request objects reject unknown fields,
including `plaintext`/`private_key`; validation failures never reflect input data.

The pinned protocol label is `signal-pqxdh-v1`. Identity/EC public keys are 33
bytes, serialized KEM public keys 1569 bytes, and signatures 64 bytes. Incoming
message types are Signal message (2) and prekey message (3). Ciphertext is
nonempty and limited to 65,536 bytes per destination; requests support up to 16
distinct destination devices and have a 2 MiB encoded body/frame bound. The
client protocol implementation validates public-key signatures and decrypts
authenticated content. Server format checks are not cryptographic verification.

Secure random public identifiers are exposed in APIs. BIGINT keys remain inside
the database. Client message IDs are UUIDs scoped to the sender device. Datetimes
follow the existing naive-UTC `datetime2` convention; clients must interpret
them as UTC, not local time.

## REST endpoints

All paths below are relative to `/api/v1/chat`. Lists of devices/conversations
and key bundles are plain arrays. Message lists use a page object.

| Method/path | Request | Response / rules |
| --- | --- | --- |
| `GET /config` | None | DB-free feature and protocol configuration. |
| `GET /conversations?limit=50&offset=0` | Bearer | Owned conversations only; maximum 100 per page. |
| `POST /conversations` | `{recipient_handle}` | Create/reuse canonical one-to-one pair; self-chat/inactive recipients rejected. |
| `GET /conversations/{public_id}` | Bearer | Owned conversation; unrelated/missing IDs both return 404. |
| `GET /conversations/{public_id}/messages?public_device_id=...&before_id=...&limit=50` | Bearer + owned active device | Message metadata and only that device's envelope; `{items,next_before_id,next_after_id:null}`. |
| `POST /messages` | `MessageSend`, below | Committed `MessageAccepted`; broadcast after commit. |
| `GET /devices` | Bearer | Caller-owned devices including revoked entries and counts of available EC/KEM one-time prekeys. |
| `POST /devices` | `{signal_device_id,registration_id,protocol_version,identity_public_key,label?}` | Register immutable public identity; identical retries return the same device. |
| `POST /devices/{public_id}/revoke` | Empty body or `{public_device_id}` matching the path | Owned device only; close its sockets and reject later operations. |
| `GET /devices/{public_id}/pending?limit=50&after_id=...` | Bearer | Unacknowledged device envelopes with transient `next_after_id` paging. |
| `POST /keys/upload` | `{public_device_id,prekeys:[...]}` | Upload owned device public prekeys; never overwrite a key ID with different material. |
| `GET /keys/{handle}` | Bearer | Active public device identity/signed/reusable KEM directory. Existing conversation required for peers; self allowed. Does not consume keys. |
| `POST /keys/{handle}/claim` | `{public_device_id}` | Atomic prekey claims per recipient device; active owned caller device required. |
| `POST /messages/{public_id}/receipts` | `{public_device_id,status:'delivered'|'read'}` | Only the original destination device may acknowledge; timestamps never regress. |

Conversation objects contain `public_conversation_id`, `peer:{user_handle,
full_name,avatar_storage_key}`, `created_at`, and `updated_at`.

Device objects contain `public_device_id`, `user_handle`, `signal_device_id`,
`registration_id`, `protocol_version`, `identity_public_key`, `label`, `created_at`,
`revoked_at`, `available_ec_one_time`, and `available_kem_one_time`. Counts are
included for the owner's list; peer bundles have null counts. Device numbers
are 1..127 and never reused, even after revocation. At most eight active devices
per account are accepted. Browser key loss requires a new number/device; it must
not silently replace the old identity.

Key bundles have `{device:DevicePublic,prekeys:PreKeyPublic[]}`. A public prekey
has `{key_kind,key_id,public_key,signature,expires_at}`. Kinds:

- `ec_signed`: current signed EC key; required for session establishment.
- `ec_one_time`: optional unsigned EC key, atomically consumed by a claim.
- `kem_one_time`: signed KEM key, preferred and atomically consumed by a claim.
- `kem_last_resort`: signed reusable KEM fallback, never marked one-time consumed.

Reusable key rotation retires older public rows without altering identities or
resetting claim tombstones. Claimed private prekeys must remain locally available
for delayed initial messages according to the client retention policy; the
backend stores no private records. Invalid signatures must fail on the client.

`MessageSend` example (ciphertext abbreviated, so this example is not executable):

```json
{
  "public_conversation_id": "chat_example_public_id",
  "public_device_id": "dev_sender_public_id",
  "client_message_id": "27a24572-2bdd-49aa-b605-072b0c84b49a",
  "envelopes": [
    {"recipient_device_id": "dev_peer_public_id", "message_type": 3, "ciphertext": "..."}
  ]
}
```

The server requires precisely the current active devices of the peer plus the
sender's other active devices. Each receives independent client-encrypted
ciphertext. Missing/stale/extra devices produce 409 so the client refreshes and
verifies the roster. The origin device stores its sent history locally rather
than receiving a redundant envelope.

Acceptance is `{public_message_id,client_message_id,created_at,duplicate}`. The
same sender-device/client UUID with identical content is idempotent. Reusing it
with changed conversation, destinations, type or ciphertext returns 409. Do not
reencrypt an accepted/retryable outbox entry with the same UUID; resend its exact
stored ciphertext. A new attempt with a changed roster needs a new UUID, and the
old request must be reconciled before abandoning it.

`MessageView` has `public_message_id`, `public_conversation_id`,
`client_message_id`, `sender_handle`, `sender_device:DevicePublic`, `created_at`,
`status`, `ciphertext`, `message_type`, and `recipient_device_id`. Ciphertext/type/
recipient are null when the caller has no envelope (e.g. the origin sender or a
new device). Local encrypted history is needed to render already-processed
messages after ratchet message keys have been deleted.

`sent` means committed by the server. `delivered` requires an explicit recipient
acknowledgement after its local history and protocol state are durably committed.
`read` requires that recipient to acknowledge viewing it. Aggregate status uses
the peer's devices only; sender sync devices never mark peer delivery/read.

Pending delivery scans must start without `after_id` on every reconnect and
periodic pass. Within a pass, follow `next_after_id` even if some messages cannot
yet be decrypted. This prevents an unverified first page from starving later
messages. Do not persist the cursor as a high-water mark: IDENTITY allocation
does not guarantee commit ordering. Delivery acknowledgement removes an item
from pending pulls, but ciphertext remains available through device-scoped
history.

## WebSocket contract

Connect to `/api/v1/chat/ws` over WSS, with the browser's matching Origin. Query
parameters are rejected; never place bearer tokens in URLs. Within ten seconds
send this first frame:

```json
{"type":"auth","token":"<existing JWT>","public_device_id":"dev_example_public_id"}
```

The server replies `{"type":"auth.ok","data":{"public_device_id":"..."}}`.
It subscribes to presence for the first 100 owned conversations. Send
`presence.subscribe` for another/current conversation when opening it. Every
operation checks the current active user, device, and conversation membership;
idle sockets recheck at most every 20 seconds. JWT expiry and revocation close
the socket. Reconnect with backoff, reauthenticate, and run pending recovery.

Outgoing operations have `{type,request_id?,data}`:

| Type | `data` | Result |
| --- | --- | --- |
| `message.send` | Same `MessageSend` object as REST; device must match socket | `message.sent` acknowledgement with request ID and committed acceptance. |
| `message.delivered`, `message.read` | `{public_message_id}`; optional matching `public_device_id` | Receipt broadcast plus `receipt.ok`. |
| `typing.start`, `typing.stop` | `{public_conversation_id}` | Authorized peer event; typing automatically expires after six seconds. |
| `presence.subscribe` | `{public_conversation_id}` | Current `user.online`/`user.offline` event for that peer. |

Incoming events have `{type,data}`:

- `message.receive`: `data` is the caller-device-scoped `MessageView`.
- `message.delivered`, `message.read`: `{public_message_id,public_conversation_id,status}`.
- `typing.start`, `typing.stop`, `user.online`, `user.offline`: `{public_conversation_id,user_handle}`.
- `device.revoked`: `{public_device_id}`, followed by connection closure.
- `error`: `{code,detail}` with no plaintext, tokens, private keys, raw validation input or SQL diagnostics.

Presence aggregates tabs/devices; closing one connection does not mark a user
offline while another authenticated connection remains. Typing is ephemeral.
Slow consumers are disconnected and recover durable pending envelopes. Connection,
authentication, user/device event and key-claim rates are bounded; clients should
back off on HTTP429/socket4429 and resume recovery.

## Verification performed

The backend suite uses real FastAPI HTTP/WebSocket adapters with an explicit
in-memory repository and a fixture that forbids SQL engine/dialect connections.
It covers authentication, conversation/device authorization, ciphertext storage
contracts, duplicate/conflicting requests, public prekeys and rotation, revocation,
destination receipts, sender sync semantics, pending pagination/reconnect,
Origin/authentication checks, live events and limiter/runtime configuration.
It does not establish MSSQL locking/DDL behavior or cryptographic correctness.

On 4 November 2026, the backend suite passed **37 tests and 10 subtests**.
OpenAPI generation and MSSQL locking-statement compilation also passed without
database access. `pip-audit 2.10.1 --local` audited 60 installed packages (runtime,
test and audit tools) and reported **zero known vulnerabilities**. Audit output
was retained locally in `.tools/backend-audit.json`; it is time-specific evidence,
not a promise that dependencies will remain vulnerability-free. Test dependencies
are pinned to the versions used, pytest 9.2.0 and httpx 0.28.1. The installed
Starlette test client emits an httpx deprecation warning; the tests still pass.

Run the database-free suite from `backend`:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.venv\Scripts\python.exe -m pytest
```

Never run `/api/v1/health/db` as a test under the no-SQL instruction: that existing
endpoint executes a query. Owner-run MSSQL migration, constraints and concurrent
key-claim checks remain required before activation.

### Browser integration through the actual relay

On 5 November 2026, `tests/chat-ui/relay-tests.mjs` passed with real browser
Signal encryption, the real React screens, and actual FastAPI HTTP/native
WebSocket requests. API/socket interception was not used. The dedicated test
backend uses the real chat router, service and JWT resolver with explicitly fake
persistence; engine and dialect connections raise immediately. Its state reported
two messages, two encrypted envelopes and zero attempted database connections.

The run verified device/key upload and claim DTOs, matching safety numbers and
mutual verification, emoji composition, safe script-text rendering, ciphertext-only
chat requests, realtime reception/read receipts, native WebSocket reconnection,
trust/history after reload, encrypted replies and a 390 px responsive viewport.
No API errors or browser page errors occurred. This still does not validate
MSSQL locking or execute the migration.

Use three terminals, starting a **fresh** isolated relay for each run. The relay
binds only to loopback and deliberately exposes its two fake account tokens;
never deploy it or point this test at the running application's backend.

Terminal 1, from `backend`:

```powershell
.venv\Scripts\python.exe -m tests.browser_relay --port 18081 --origin http://127.0.0.1:15173 --origin http://localhost:15173
```

Terminal 2, from `frontend`:

```powershell
$env:VITE_PROXY_TARGET='http://127.0.0.1:18081'
npm.cmd run dev --workspace web -- --host 127.0.0.1 --port 15173 --strictPort
```

Terminal 3, from `frontend/apps/web` (Chrome/Playwright prerequisite as for the
other browser tests):

```powershell
node tests/chat-ui/relay-tests.mjs
```

The runner uses fresh browser contexts, seeded `alice`/`bob` accounts and explicit
loopback URLs. Override only its isolated URLs through `CHAT_RELAY_UI_URL` and
`CHAT_REAL_RELAY_URL` if needed. It refuses a relay without the test-only marker.
Close both test servers after the run. A fresh relay is necessary for repeated
runs because old test devices remain registered in its in-memory state while
the runner deliberately discards browser keys when closing its contexts.
