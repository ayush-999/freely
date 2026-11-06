# Profile and social UI

The profile pages reuse the existing cards, buttons, typography, media controls,
authentication, public identity DTOs, and secure messaging page.

- `/profile` has an Edit profile button beside View public profile. It opens
  **Edit Profile Details** below the header. Cancel or Escape discards the draft;
  saving updates the existing auth profile and closes the panel. Empty optional
  fields are sent as `null`. The public self-profile links to `/profile?edit=1`.
- Own/public profiles and the home profile summary show follower/following
  counts. Clicking either count opens a paginated people list.
- Other users' public profiles, people search results, and people lists expose
  Follow/Following and Message actions. Following can be clicked to unfollow.
  Guests are directed through the existing login flow with the destination
  preserved. Self-follow and self-message controls are omitted.
- Message links use `/messages?to=<handle>`. The existing secure chat waits for
  initialization, selects an existing conversation or creates one, and provides
  a retry when opening fails. Existing chat readiness settings still apply.
- Grievance notifications link to their existing detail page. List loading and
  mark-read failures can be retried.

## Existing follow graph

These API adapters use the existing `user_follows` table. No database schema or
migration changes are required for this profile work.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/v1/users/{handle}/relationships` | Active-user counts and viewer relationship |
| GET | `/api/v1/users/{handle}/followers` | Public people page |
| GET | `/api/v1/users/{handle}/following` | Public people page |
| PUT | `/api/v1/users/{handle}/relationships/follow` | Idempotent follow |
| DELETE | `/api/v1/users/{handle}/relationships/follow` | Idempotent unfollow |

People pages support `limit` (default 20, maximum 100) and `offset`. Public reads
exclude inactive accounts and private identity fields. Mutations require the
existing authenticated user and reject self-follow. The legacy numeric-ID
toggle endpoint remains available.

## Verification

From `frontend`, run `npm.cmd run lint`, `npm.cmd test`, and
`npm.cmd run build`. Unit coverage includes editing, website validation,
relationship updates, lists, retries, stale-account requests, public profile
loading, notifications, and messaging destinations.

From `backend`, run `.venv\Scripts\python.exe -m pytest -q`. Relationship tests
use an in-memory repository and compile MSSQL queries without executing them.

For the production browser checks, start a local Vite preview on port 4188 from
`frontend/apps/web` with `npm.cmd run preview -- --host 127.0.0.1 --port 4188
--strictPort`, then run `npm.cmd run test:profile-ui`. Override the preview URL
with `PROFILE_UI_TEST_URL` if needed. The harness intercepts every API and
WebSocket before navigation, fails on unknown APIs, and checks desktop/mobile
flows, browser errors, and CSP violations. Screenshots are written to the ignored
`.tools/profile-ui` directory. These checks do not access the database.

Verified for this change: lint and production build passed; 64 frontend unit
tests and 46 backend tests passed. The profile browser harness and the existing
real-browser Signal chat harness both passed against the production preview,
including responsive layout and CSP checks, with every API/socket intercepted.
