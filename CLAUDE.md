# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

PulseChat — a real-time chat app with rooms, DMs, presence, typing indicators,
read receipts and an LLM assistant that streams replies over the socket.

Two independent npm packages, no workspace tooling:

```
client/    React 19 · Vite · Tailwind v4 · React Router 7 · socket.io-client
server/    Node · Express 5 · Mongoose 9 · Socket.io 4 · JWT
docs/      MongoDB Atlas setup walkthrough
```

Each half has its own README with the full architecture. Read those before a
substantial change; this file covers what is easy to get wrong.

## Commands

Run from `server/`:

| | |
| --- | --- |
| `npm run start:dev` | nodemon against `MONGO_URI` (the normal one) |
| `npm run start:local` | whole backend on an in-memory MongoDB, pre-seeded — no Atlas needed |
| `npm run smoke` | 46 end-to-end assertions; no Atlas and no AI key required |
| `npm run seed` | wipe and rebuild demo data |

Run from `client/`:

| | |
| --- | --- |
| `npm run dev` | Vite on :5173 |
| `npm run build` | production build — no TypeScript here, so this is what catches broken imports and bad JSX |
| `npm run lint` | ESLint, currently clean at 0/0 |

**Always run `npm run smoke` after touching anything in `server/src/`.** It boots
the real app against an in-memory database and has already caught several
regressions that looked fine on inspection.

## Version gotchas

These are current-major behaviours that differ from most tutorials and from
older training data. Getting them wrong produces confusing runtime failures.

- **Mongoose 9 does not pass `next` to async middleware.** An `async` pre-hook
  returns to signal completion. Writing `pre('save', async function (next) {…})`
  throws `next is not a function` on every save.
- **Mongoose 9 deprecated `{ new: true }`** on `findOneAndUpdate` — use
  `{ returnDocument: 'after' }`.
- **Express 5** forwards rejected promises to the error middleware
  automatically, and wildcard routes need a name (`/*splat`, not `*`).
  `req.query` is a getter and cannot be reassigned.
- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js`. Design tokens
  live in `client/src/index.css` under `@theme inline`, which maps CSS variables
  to utilities so one `.dark` class re-themes everything. Add a colour by adding
  a variable in both `:root` and `.dark`, then one line in `@theme inline`.
- **express-rate-limit v8** rejects a `keyGenerator` that falls back to a raw
  `req.ip`; use the exported `ipKeyGenerator` helper.

## Things that are load-bearing

**Socket listeners must be registered synchronously in `io.on('connection')`,
before any `await`.** Socket.io does not buffer inbound events for handlers that
do not exist yet, so a client emitting on `connect` gets its first event silently
dropped. The async bootstrap (presence, joining rooms) runs in an IIFE after the
wiring. See `server/src/socket/index.js`.

**Identity always comes from `socket.user`, never from a payload.** The JWT is
verified once in `io.use()`. A `send_message` payload containing a `sender` field
is ignored, and the smoke suite asserts that.

**Presence is `Map<userId, Set<socketId>>`.** Multi-tab correctness depends on
only the empty↔one transitions touching the database. A reload interleaves a
connect and a disconnect within milliseconds, so `syncOnlineFlag` writes what the
map says *at write time* and re-checks afterwards. Do not simplify this to a
plain boolean write.

**`typing` is re-announced on a 2s heartbeat, not once per burst.** Receivers
expire a stale indicator after 5s; a single event per burst drops the indicator
mid-sentence. `TYPING_HEARTBEAT` and `TYPING_DEBOUNCE` in
`client/src/utils/constants.js` are coupled to that 5s sweep in `ChatContext`.

**`error` events carry a `roomId` when the failure belongs to a conversation.**
That is what lets the client clear a stuck "AI is thinking…" state. Preserve it
when adding new socket errors.

**AI chunks relay per provider chunk — do not reintroduce timer coalescing.** It
was tried and reverted: a short reply arrives in one burst before any interval
fires, so the whole answer shipped as a single `ai_stream` frame and the bubble
snapped to full text with no typing effect. Providers emit tens of chunks per
reply, not thousands. If frame volume ever becomes a real problem, measure first
and cap by count, not by timer.

## The client/server contract

`client/src/utils/constants.js` holds the socket event names; the REST calls are
all in `client/src/api/index.js`. Both READMEs document the shapes. Two details
the client depends on:

- `receive_message` echoes back the sender's `tempId` so an optimistic bubble
  reconciles exactly.
- `GET /rooms` returns a per-room `unread` count so badges survive a refresh.

List endpoints on the client tolerate both a bare array and a `{ key: [...] }`
wrapper — keep that tolerance when adding endpoints.

## Demo mode

`VITE_DEMO_MODE=true` in `client/.env` swaps the REST client and the socket for
in-memory fakes in `client/src/mock/` that speak the identical contract. It is
`false` by default now that the backend exists. **No component imports the mocks
directly** — if you add an API method or socket event, add it to the mock too, or
demo mode silently breaks.

## Conventions

- ES modules everywhere, `.jsx` only for files that render.
- Server: controllers stay thin, shared logic lives in `src/services/`.
  Throw `ApiError.badRequest(...)` and let `error.middleware.js` shape it — every
  error reaches the client as `{ message }`, which is what the axios interceptor
  reads.
- Client: `ChatContext` owns all chat state (rooms, message caches, presence,
  typing, AI streams, unread). Components stay presentational.
- Contexts are created in `client/src/context/contexts.js`, separate from the
  providers, so Vite fast-refresh survives edits to either.
- Comments explain *why*, not *what*. Match the surrounding density.

## Environment

- Windows. The Bash tool is Git Bash; PowerShell is also available.
- **Do not bulk-edit source with PowerShell `Get-Content`/`Set-Content`.**
  Windows PowerShell 5.1 reads as ANSI and writes UTF-8, which silently
  corrupts every non-ASCII character in the file (emoji, em dashes, box
  drawing). Use the Edit tool.
- `server/.env` and `client/.env` are gitignored and contain real secrets once
  configured. Never paste their contents into a commit, an issue, or an artifact.
