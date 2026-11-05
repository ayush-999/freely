# Chat database changes and manual execution

The chat extension adds five tables to the existing Freely database. It does
not alter, rename, or delete any of the original 47 tables, their relationships,
indexes, constraints, or three platform-role seed rows. No database script or
query was executed while preparing this change.

The updated `backend/database/schema.sql` retains the existing definitions and
adds chat immediately before the seed section. Its final table count is now
52; the prior message incorrectly said 45 for the original 47 tables. The
matching definitions are appended to `docs/freely.dbml`.

## Objects and execution order

| Order | New table | Purpose |
| --- | --- | --- |
| 1 | `dbo.chat_conversations` | Immutable canonical pair of existing `users.id` values; unique pair prevents duplicate one-to-one conversations. |
| 2 | `dbo.chat_devices` | Existing user ownership, Signal device/registration numbers, public identity key and revocation metadata. |
| 3 | `dbo.chat_prekeys` | Public signed EC, one-time EC, one-time KEM and reusable last-resort KEM keys. No serialized private prekey records. |
| 4 | `dbo.chat_messages` | Conversation/sender metadata and a client UUID plus request digest for idempotency. |
| 5 | `dbo.chat_message_envelopes` | One bounded ciphertext per destination device, with explicit delivered/read timestamps. |

Each table has a named primary key. Unique public identifiers and canonical
pair/client UUID/device numbers have named unique constraints. Composite
foreign keys bind sender and destination devices to their actual existing user
owners. All timestamps are UTC `datetime2`, matching the existing application.

Indexes cover each participant's conversation list, active devices, available
prekeys, conversation history, and pending/history envelopes for a destination
device. Receipt timestamps need no separate table. Presence and typing are
ephemeral and do not require schema changes.

Database CHECK constraints bound identity/EC public keys to 33 bytes, current
Kyber public keys to 1569 bytes, signed-key signatures to 64 bytes, and opaque
ciphertext to 1–65536 bytes. The explicit protocol is `signal-pqxdh-v1` and
message types are Signal normal (2) or prekey (3). Private keys and plaintext
have no columns or API fields. Changing protocol formats requires an explicit
reviewed future migration; a version string alone cannot bypass these checks.

The pair CHECK enforces two distinct, ordered user IDs. ChatService must also
authorize senders/destinations against that immutable pair in each transaction;
a standard FK alone does not enforce the cross-table either-participant rule.
Only authenticated active devices may receive their own envelopes or acknowledge
them. Administrative roles do not grant chat membership.

## Before running the upgrade

1. Review and back up the intended existing database using your established
   backup process. Keep chat disabled in both frontend and backend.
2. Confirm SQL Server 2019+ or Azure SQL, database compatibility level 110 or
   newer (required for ordered `STRING_AGG` catalog validation), and that the connection selects the
   intended Freely database. The script intentionally has no `USE` statement or
   embedded credentials; your SSMS/sqlcmd database selection is authoritative.
3. Confirm `dbo.users.id` is the existing nonnullable BIGINT unique identifier.
   The migration checks this prerequisite without changing it.
4. Use an operator account authorized to create tables, constraints, indexes,
   and references to `dbo.users`. The migration also uses the standard
   `sp_getapplock` transaction lock. The application's runtime account should
   have only the required data permissions, not schema alteration permissions.

## Run the exact standalone migration manually

Open `backend/database/migrations/001_chat_up.sql` in SSMS, select your existing
database explicitly, review the entire file, and execute it yourself. For a
Windows-authenticated local instance, the equivalent command from `backend` is:

```powershell
sqlcmd -S localhost -E -d freely -b -i database/migrations/001_chat_up.sql
```

Substitute your actual server/database if different. No execution is performed
by the application or by an installation command. Do **not** run the complete
`schema.sql` against an existing database; it is the full empty-database script.

The standalone migration performs these steps in one `XACT_ABORT` transaction:

1. Acquire a migration lock and check the existing user-key prerequisite.
2. Reject conflicting non-table objects and partial chat schemas.
3. Create all five tables in FK dependency order if none exists, including the
   named constraints and supporting indexes.
4. Verify every expected column type/length/precision/scale, nullability and
   identity property; named PKs, unique constraints, CHECK expressions,
   defaults, FK column pairing and index definitions; trusted/enabled
   constraints, identity increment and absence of unexpected table triggers.
5. Derive expected CHECK catalog definitions using this SQL Server's own parser
   on a session-local temporary reference table with matching column types and
   database collation. This handles canonical rewrites such as `IN` lists or
   `BETWEEN` without guessing their catalog text. Compare case and grouping,
   then remove the temporary reference. No sixth persistent table is added.
6. Commit only if all checks succeed. An incompatible existing chat object
   causes a rollback instead of being silently skipped.

A compatible rerun validates the existing five-table schema and makes no data
changes. If the script reports a mismatch, inspect it before proceeding rather
than deleting objects or bypassing the guard. Preserve the error text and do
not enable chat until the schema and application checks are resolved.

Only after you confirm the migration succeeded and the application crypto
checks pass should you enable the chat feature and restart the application.
Editing SQL files alone never means the live database has been upgraded.

## Safe rollback

Disable chat and stop its active connections/workers first. Review
`backend/database/migrations/001_chat_down.sql` and execute it manually in the
same explicitly selected database if all five added tables are empty:

```powershell
sqlcmd -S localhost -E -d freely -b -i database/migrations/001_chat_down.sql
```

The guarded transaction locks the new tables against concurrent writes and
refuses rollback when **any** chat data exists, including devices or public
prekeys. For an unused installation, it drops envelopes, messages, prekeys,
devices and conversations in reverse dependency order. It does not change
original tables or seeds. A rerun after successful removal is a no-op.

After chat has been used, the safe rollback is to disable the feature and keep
the encrypted tables. Removing used tables discards ciphertext, receipts and
published key metadata; it requires a separate explicit decision and backup,
and the supplied rollback deliberately refuses to do so.

## Operational behavior and verification limits

One-time EC/KEM keys are claimed atomically; reusable last-resort KEM keys are
not marked consumed. The backend retains claimed public-key tombstones and
rejects changed reuse of a key ID. Signed-key rotation retires old availability
without silently replacing the device's identity. Device numbers are not
recycled while old sessions/envelopes may still refer to them.

The backend commits a message and its envelopes before acknowledging sent.
Delivered/read updates require explicit destination-device acknowledgements.
Clients periodically pull unacknowledged envelopes, including after reconnect;
an IDENTITY cursor alone cannot cover transactions that commit out of order.
Cryptographic replay rejection remains a client protocol responsibility.

The ORM definitions were compiled with SQLAlchemy's MSSQL dialect and checked
against the new DDL without opening a database connection. Those checks do not
establish successful MSSQL execution, locking behavior, permission behavior,
or query performance. Migration/rollback and concurrent key claims require
your manual database verification; no such result is reported as passed.
