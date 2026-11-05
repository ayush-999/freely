# Chat encryption architecture and verification

The chat client uses the exact npm artifact `@getmaapp/signal-wasm@0.6.6`,
locked by npm integrity in the frontend lockfile. Its source declares an
AGPL-3.0-only license and wraps pinned official Rust libsignal v0.101.0.
AGPL/GPL dependencies were accepted by the owner. The adapter implements
persistence and application routing; all identity generation, signatures,
PQXDH establishment, ratchets, message encryption/decryption and safety numbers
are library operations. No application cryptographic algorithm was introduced.

The official TypeScript package is a native Node library and is used only as
an independent interoperability test peer, not shipped in the browser app.
The original official browser JS implementation is archived and was not used.
Signal does not support third-party libsignal use; upstream and wrapper APIs
must be reviewed and retested before changing either pinned version.

## Identity persistence workaround

The WASM bridge exposes no import/export for remote identity pins. Creating a
fresh identity store would otherwise silently reset trust on every reload.
`SignalEngine.hydrate()` reconstructs that map entirely through libsignal's
existing `processPreKeyBundle` operation: each locally pinned **signed public
bundle** is processed against a disposable session store and the live identity
store. This validates the bundle's signatures and inserts the pinned identity.
The resulting dummy session is immediately discarded; it is never transmitted,
persisted or substituted for a real session. Real serialized session records
are then imported into the separate real session store. Cached retired public
bundles are used only for local identity hydration, never to claim server keys.
When an established session's peer has been offline long enough for its public
prekeys to expire from the live directory, the client preserves this locally
pinned signed bundle after checking the unchanged identity, account, device and
registration identifiers. Existing ratchets keep working after reopening the
vault. A new session still requires a valid current bundle; incomplete directory
records never bypass identity checks or invalid supplied signatures.

Every sender must have a pinned signed bundle before decryption. Changed public
identity, account, device number or registration ID is rejected. New devices are
unverified until their 60-digit library safety number is compared out of band.
The UI must not mark a device verified merely because its directory record was
downloaded. Sending requires all destination devices to be verified. Receiving
from a first-use pinned but unverified device is allowed and remains visibly
unverified. Identity replacement uses explicit device revocation/registration
and new peer verification, rather than silently overwriting the old pin.

This hydration behavior is covered by actual browser tests, including changed
identity rejection and replay rejection after reopening the vault. It is still
an application workaround that must be retested on every wrapper upgrade.

## Device storage, transactions and recovery

`ChatCrypto` uses a separate IndexedDB database per canonical account handle.
One sealed state record contains the serialized private identity and prekeys,
sessions, Kyber replay memory, trusted public bundles, verification decisions,
encrypted outgoing queue and local message archive. The record is encrypted
with browser WebCrypto AES-256-GCM using a fresh 96-bit random nonce for each
write and account-specific authenticated data. A nonextractable CryptoKey is
stored by IndexedDB structured cloning. No private record goes into
localStorage, Redux, HTTP/WebSocket DTOs or backend storage.

Every read/mutation obtains an account-specific Web Lock, reads a fresh sealed
snapshot, and hydrates temporary library stores. Sending commits advanced
ratchets, original ciphertext/outbox and encrypted sent history in one state
write before returning any envelope to the transport. Retry sends the exact
same ciphertext/client UUID. A definitive roster rejection can explicitly
prepare a replacement with a new UUID; ambiguous network failures must never
trigger re-encryption.

Receiving commits advanced sessions, consumed one-time-key deletion, Kyber
anti-replay state and encrypted local history before returning success to the
transport. Delivery may be acknowledged only afterward. Failed crypto,
authenticated-routing validation or durable writes discard the draft state.
Web Locks serialize tabs sharing a browser profile. Unsupported secure storage
or Web Locks fails closed. Logout closes the vault and clears page plaintext;
it does not erase the encrypted archive or pretend to erase the browser's
garbage-collected memory.

Encrypted application payloads bind protocol version, conversation ID, client
message UUID, sender handle/device ID and destination device ID alongside the
text. The client checks all these against transport metadata after decryption,
preventing the relay from silently moving valid ciphertext into another chat.
Only text nodes render decrypted messages, including emoji and HTML-like text.

## Prekeys, rotation, revocation and history

The protocol directory stores only serialized public keys and signatures.
Current formats tested: identity/EC public keys 33 bytes, signatures 64 bytes,
Kyber public keys 1569 bytes. The backend requires KEM keys of exactly 1569 bytes and
ciphertext at 65536 bytes. Message types 2 and 3 are accepted.

The vault provisions 20 EC one-time keys, five signed KEM one-time keys, one
signed EC key and one signed KEM last-resort key. Signed/reusable keys rotate
after seven days. The server's available-key counts drive replenishment even
when a claimed key's initial message never arrived. Claimed private prekeys
remain available for delayed messages, then expire after 30 days. Old signed
private records also retain a 30-day overlap. More than 4096 pending private
keys blocks replenishment rather than silently discarding pending keys. Key IDs
increase and are never recycled within a device. Exhausted IDs require an
explicit replacement device. Last-resort KEM keys remain reusable while their
library replay memory is persisted; one-time KEM records are tombstoned after
successful consumption.

Ratchet forward secrecy requires discarding consumed message keys. The device
archive stores separately encrypted rendered history, rather than retaining
old ratchet keys so server ciphertext can always be decrypted again. The sender
archives its own messages and encrypts distinct envelopes to the other trusted
devices. New devices cannot automatically decrypt old device envelopes. Losing
this browser's key/archive storage can make its history unavailable. Secure
history transfer and remote private-key backup are outside this implementation.
Revocation denies future server operations but cannot erase already decrypted
content. Delayed envelopes from a revoked sender may use its already pinned
public bundle; an unknown revoked sender cannot establish implicit trust.

## Threat limits and deployment requirements

HTTPS/WSS, the production document CSP, safe text rendering, dependency pinning
and controlled frontend deployment are required. Browser E2EE does not protect
against malicious frontend code, same-origin XSS with key-use access, a
compromised browser/device or rollback of local browser data by an attacker
controlling the profile. A nonextractable wrapping key does not prevent hostile
same-origin code from requesting decryption. The backend still observes routing,
timing, device, presence and receipt metadata. Verification must occur outside
the potentially malicious relay to authenticate first use.

## Tests actually executed

On 4–5 November 2026, actual Chrome/Chromium, Firefox 157 and Playwright WebKit
27.2 runs passed:

- Encrypted Unicode/emoji roundtrip, out-of-order messages and signed-prekey
  signature rejection.
- Safety-number agreement, sending blocked before verification, persisted
  verification/identity/history after vault reopening, and changed identity
  rejection after reopening.
- Duplicate/replay rejection after reopening, encrypted vault inspection,
  original outbox ciphertext reuse, monotonic receipts and closed-vault guards.
- Established-session operation after live directory prekey expiry, with
  cached identity pins preserved across reopening; rejection of new sessions
  with missing current prekeys and of changed identities in empty directories.
- Tampered message rejection, authenticated-routing substitution rejection,
  safe subsequent retry, and simulated IndexedDB write-failure rollback.
- Explicit replacement of definitively rejected pending ciphertext without
  duplicating local history.
- Consumed past-message rejection by current protocol state and a captured old
  receiver session's inability to decrypt after fresh honest ratchet exchanges.
  These are behavioral security tests, not a new formal proof of Signal.
- Signed-prekey rotation, server-count-based replenishment and delayed-key
  overlap retention.
- Bidirectional browser interoperability with **official native
  `@signalapp/libsignal-client@0.101.0`**, rather than only the wrapper against
  itself.

No SQL or application backend endpoint is used by this harness. These results
do not establish production MSSQL locking, migrations, deployment security or
an independent security audit. The wrapper's own audit report is not an
independent audit of this application.

To reproduce from the repository root:

```powershell
cd frontend/apps/web
node tests/crypto/install-native-peer.mjs
npx playwright install firefox webkit
npm run dev -- --host 127.0.0.1 --port 4187 --strictPort
```

In another terminal in `frontend/apps/web`, with Chrome installed:

```powershell
node tests/crypto/browser-tests.mjs
$env:CHAT_CRYPTO_BROWSER = 'firefox'
node tests/crypto/browser-tests.mjs
$env:CHAT_CRYPTO_BROWSER = 'webkit'
node tests/crypto/browser-tests.mjs
Remove-Item Env:CHAT_CRYPTO_BROWSER
```

The native peer installer uses the committed test-only manifest and lockfile,
installs under ignored `.tools/chat-crypto`, and disables install scripts.
`CHAT_NATIVE_MODULE` can override the native module path.
`CHAT_CRYPTO_TEST_URL` can override the isolated Vite origin. Do not run the
crypto tests against a normal application page that calls backend endpoints.

## Primary implementation references

- [Official libsignal support/API/license](https://github.com/signalapp/libsignal)
- [Signal WASM wrapper source/API](https://github.com/getmaapp/signal-wasm)
- [Pinned upstream identity store](https://raw.githubusercontent.com/signalapp/libsignal/b056faa6dd02961cff24064c54c089c52e1a0753/rust/protocol/src/storage/inmem.rs)
- [Signal Double Ratchet](https://signal.org/docs/specifications/doubleratchet/)
- [Signal multi-device sessions](https://signal.org/docs/specifications/sesame/)
