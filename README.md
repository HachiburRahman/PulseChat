# PulseChat

Real-time chat with rooms, direct messages, live presence, typing indicators and
read receipts — plus an AI assistant whose answers stream in token by token over
the same WebSocket.

**React 19 · Vite · Tailwind v4 · Node · Express 5 · Socket.io · MongoDB Atlas · JWT**

```
client/   React SPA          → see client/README.md
server/   Express + Socket.io → see server/README.md
```

---

## Run it

Two terminals. The backend first:

```bash
cd server && npm install && npm run start:local
```

`start:local` boots the whole API against a throwaway in-memory MongoDB, seeded
with demo data — no Atlas account needed to see the app working. Swap to
`npm run start:dev` once `MONGO_URI` points at a real cluster
(see **[docs/mongodb-atlas.md](docs/mongodb-atlas.md)**).

Then the frontend:

```bash
cd client && npm install && npm run dev
```

Open <http://localhost:5173> and sign in as **demo@pulsechat.app** / **pulsechat123**.

To watch the realtime layer do its job, open a second browser profile and sign in
as `theo@pulsechat.app` with the same password.

### Wiring up the real services

| | Where |
| --- | --- |
| MongoDB Atlas | `server/.env` → `MONGO_URI` — [step-by-step guide](docs/mongodb-atlas.md) |
| JWT secret | `server/.env` → `JWT_SECRET` |
| AI provider key | `server/.env` → `GEMINI_API_KEY` (or Groq / OpenAI) |
| Firebase Storage | `client/.env` → the `VITE_FIREBASE_*` block |

The AI key lives **only** on the server. The browser never sees it, never calls
the provider, and every AI route is rate limited per user.

---

## Tests

```bash
cd server && npm run smoke
```

46 end-to-end assertions against the real app on an in-memory database — auth,
authorisation, cursor pagination, unread counts, every socket event, and the AI
failure path. No Atlas connection and no provider key required.

---

## How the three channels fit together

```
   React SPA  ──── REST (axios) ────►  Express        ──►  MongoDB Atlas
              ◄─── JSON ────────────   JWT auth
              ◄══ WebSocket ═════════► Socket.io      ──►  AI provider
                  messages, typing,    presence,           (key server-side)
                  presence, AI stream  streaming
   Firebase Storage ◄── media bytes go straight from the browser;
                        only the resulting URL travels through chat
```

REST for request/response, the socket for anything live, and a server-side call
to the AI provider. History loads over REST; new messages stream over the socket.

---

## The parts worth talking about in an interview

**One authenticated handshake.** The JWT travels in `io(url, { auth: { token } })`
and is verified once in `io.use()`. Every later event on that connection already
belongs to a known user, so no handler ever reads an identity from a payload —
the test suite asserts that a spoofed `sender` field is ignored.

**Presence that survives five tabs.** `Map<userId, Set<socketId>>`; only the
empty↔one transitions touch the database. A reload interleaves a connect and a
disconnect within milliseconds, so the persisted flag is written from the map at
write time and re-checked afterwards — otherwise a late write marks a live user
offline.

**Streaming that actually streams.** An earlier version coalesced provider
chunks on a 45ms timer to save socket frames. Measuring it showed the flaw: a
short reply arrives in one burst before any timer fires, so the whole answer
shipped as a single frame and the bubble snapped to full text with no typing
effect. Chunks now relay as they land — 6 frames with 37-178ms gaps on a typical
reply, which is what the feature exists to demonstrate.

**Cursor pagination, not `skip`.** `createdAt < before` against a
`{ room: 1, createdAt: -1 }` index stays fast however far back you scroll, and
cannot double-count when new messages land mid-scroll.

**Failure states that are honest.** With no AI key the assistant explains itself
rather than crashing: `/api/ai/status` says why, the REST route returns 503, and
the socket path emits an `error` carrying its `roomId` so the room clears its
"thinking…" state instead of spinning forever.

---

## Deploying

Full walkthrough: **[docs/deploy.md](docs/deploy.md)** — GitHub, then Render,
then Vercel, with the verification steps and the mistakes that cost an hour.

| Piece | Host | Note |
| --- | --- | --- |
| `client/` | Vercel | static build; `vercel.json` handles SPA deep links |
| `server/` | Render | must hold long-lived WebSockets — most serverless cannot |
| Database | MongoDB Atlas | free M0 tier is plenty · [setup guide](docs/mongodb-atlas.md) |
| Media | Firebase Storage | optional; uploads fall back to a local preview |

Deploy the backend first — the frontend bakes `VITE_API_URL` into its bundle at
build time, so it needs the API's URL before it builds.

Set `CLIENT_URL` on the server to the deployed frontend origin, with no trailing
slash. CORS is configured separately for Express and for Socket.io; both read it
through the same `isAllowedOrigin` check.
