# PulseChat — server

Express REST API + Socket.io realtime layer + MongoDB, with a streaming LLM
assistant. This is the half the React client in [`../client`](../client) talks to.

**Node · Express 5 · Mongoose 9 · Socket.io 4 · JWT · bcrypt · MongoDB Atlas**

---

## Quick start

```bash
npm install
```

Copy the environment template and fill in two values:

```bash
cp .env.example .env
```

| Variable | Where it comes from |
| --- | --- |
| `MONGO_URI` | Atlas → your cluster → **Connect** → **Drivers** |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

Then:

```bash
npm run seed
```

```bash
npm run start:dev
```

The API is on `http://localhost:5000/api`, the socket on the same port.

### No Atlas cluster yet?

```bash
npm run start:local
```

Boots the entire backend against a throwaway in-memory MongoDB, seeded with demo
data. Nothing persists — but every route, socket event and index behaves exactly
as it will against Atlas. The first run downloads a MongoDB binary.

| Script | What it does |
| --- | --- |
| `npm run start:dev` | nodemon against `MONGO_URI` — the normal one |
| `npm run start:local` | full stack on an in-memory database, pre-seeded |
| `npm start` | production start |
| `npm run seed` | wipe and rebuild demo data |
| `npm run smoke` | end-to-end test suite (no Atlas, no AI key needed) |

### Demo accounts after seeding

`demo@pulsechat.app`, `theo@`, `priya@`, `sam@`, `lena@` — password `pulsechat123`.

---

## Atlas setup

Full walkthrough with troubleshooting: **[../docs/mongodb-atlas.md](../docs/mongodb-atlas.md)**.

The short version:

1. Create a free **M0** cluster.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → add your IP. A deployed server on Render or Railway
   needs `0.0.0.0/0` — neither publishes fixed egress IPs on standard plans.
4. **Connect → Drivers** → copy the string, replace `<db_password>`, and add a
   database name: `…mongodb.net/pulsechat?retryWrites=true&w=majority`.

**URL-encode the password** if it contains `@ : / ? # [ ] %` — an un-encoded `@`
is the single most common cause of "could not connect".

---

## Tests

```bash
npm run smoke
```

46 assertions covering auth, authorisation, rooms, cursor pagination, unread
counts, every socket event, and the AI failure path. It spins up an in-memory
MongoDB and the real app — no Atlas connection and no provider key required, so
it runs anywhere including CI.

It is deliberately blunt about the things that are easy to get wrong:

- a forged or missing JWT is rejected on both REST and the socket handshake
- a non-member can neither read a room's history nor post to it
- a client-supplied `sender` in a `send_message` payload is ignored
- `typing` reaches other people but never echoes back to the sender
- a live user is never left marked offline after a reload race

---

## API

🔒 = requires `Authorization: Bearer <token>`.

| Method | Endpoint | Returns |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{ token, user }` |
| `POST` | `/api/auth/login` | `{ token, user }` |
| `GET` | `/api/auth/me` 🔒 | `{ user }` |
| `GET` | `/api/users` 🔒 | `{ users }` — everyone else, assistant included |
| `PUT` | `/api/users/profile` 🔒 | `{ user }` |
| `GET` | `/api/rooms` 🔒 | `{ rooms }` — populated members, `lastMessage`, `unread` |
| `POST` | `/api/rooms` 🔒 | `{ room }` |
| `POST` | `/api/rooms/dm/:userId` 🔒 | `{ room }` — get-or-create; pass the bot's id for the AI chat |
| `GET` | `/api/messages/:roomId?before&limit` 🔒 | `{ messages, hasMore }` |
| `PATCH` | `/api/messages/:roomId/read` 🔒 | `{ updated }` — clears a backlog in one call |
| `POST` | `/api/ai/chat` 🔒 | `{ message }` — non-streaming fallback |
| `GET` | `/api/ai/status` 🔒 | `{ configured, provider, reason }` |
| `GET` | `/api/health` | `{ ok, uptime, db, env }` |

### Socket events

**Client → server:** `join_room`, `leave_room`, `send_message`, `ai_message`,
`typing`, `stop_typing`, `mark_read`, `note_update`.

**Server → client:** `receive_message`, `ai_typing`, `ai_stream`, `ai_done`,
`typing`, `stop_typing`, `presence_update`, `message_read`, `note_update`,
`error`.

Two details the client relies on:

- `receive_message` echoes back the `tempId` the sender supplied, so an
  optimistic bubble can be reconciled exactly rather than by guessing.
- `error` carries the `roomId` when the failure belongs to a conversation —
  without it a failed AI reply would leave that room showing "thinking…" forever.

---

## How the pieces work

### Auth, once per connection

Register and login hash with bcrypt (cost 12) and return a JWT holding only the
user id — everything else is read fresh per request, so a week-old token can
never carry a stale name or avatar.

REST reads `Authorization: Bearer`. The socket reads the same token from the
handshake:

```js
const socket = io(URL, { auth: { token } })   // client
io.use(socketAuth)                            // server, runs once per connection
```

After the handshake every event on that socket already belongs to a known user,
which is why no handler ever reads an identity out of a payload. `send_message`
takes its sender from `socket.user`, and the smoke test asserts that a spoofed
`sender` field is ignored.

### Presence across multiple tabs

`Map<userId, Set<socketId>>`. Five tabs is five socket ids under one key, and
only the empty→one and one→empty transitions touch the database. A page reload
interleaves a connect and a disconnect within milliseconds, so the persisted
`isOnline` flag is written from whatever the map says *at write time* and then
re-checked — otherwise a late-landing write can mark a live user offline.

Broadcasts only fire when somebody joins or leaves, so each socket is also
handed a private roster snapshot once it finishes joining its rooms. That makes
clients self-healing rather than dependent on catching one broadcast.

Set `DEBUG_PRESENCE=true` to log the map on every change.

### History

Cursor pagination on `createdAt`, never `skip` — `skip` gets slower the further
back you scroll and double-counts when new messages land mid-scroll. One extra
row is fetched to answer `hasMore` without a second `countDocuments`.

```js
messageSchema.index({ room: 1, createdAt: -1 })
```

### The AI assistant

The assistant is an ordinary `User` with `isBot: true`. That is what lets it own
messages, sit in a DM, and render through the same components as anyone else.

When a message starts with `@ai` — or lands in a room where `isAiRoom` is true:

1. the user's message is saved and broadcast, so everyone sees the question
2. `ai_typing` goes out to the room
3. a short system prompt plus the last ~10 messages go to the provider
4. tokens arrive and are relayed as `ai_stream`
5. the finished answer is saved with `isAi: true` and sent as `ai_done`

Chunks relay to the room as they arrive from the provider. A previous version
coalesced them on a 45ms timer to save frames, which backfired: short replies
arrive in one burst before any timer fires, so the answer shipped as a single
frame and the UI showed no typing effect at all. Tens of frames per reply is
well within budget.

**`aiService.js` is provider-agnostic and built on `fetch`, not a vendor SDK** —
streaming is just server-sent events, and there is no SDK to keep current. Set
`AI_PROVIDER` to `gemini`, `groq` or `openai`; nothing else in the codebase
knows which is in use.

With no key configured the assistant degrades honestly: `GET /api/ai/status`
explains why, `POST /api/ai/chat` returns 503, and `@ai` emits an `error`
carrying its `roomId`. It never crashes and never blocks the rest of the app.

### Keeping the key safe

The provider key exists only in `server/.env`. The browser never sees it and
never talks to the provider. On top of that:

- `POST /api/ai/chat` is rate limited per authenticated user (`AI_REQUESTS_PER_HOUR`)
- the socket path enforces the same hourly budget per user
- one answer in flight per room; a second `@ai` is refused rather than queued
- context is capped at `AI_CONTEXT_MESSAGES`, output at `AI_MAX_OUTPUT_TOKENS`

### Everything else

`helmet`, `compression`, CORS locked to `CLIENT_URL` for **both** Express and
Socket.io (they are configured separately — a classic half hour of confusion),
rate limits on auth and AI routes, `password` marked `select: false`, and a
single error middleware that turns anything thrown into `{ message }` — the
shape the client's axios interceptor already reads.

---

## Deploying

Use a host that holds long-lived connections — **Render** and **Railway** both
do; most serverless platforms do not.

```
MONGO_URI      your Atlas string
JWT_SECRET     a long random value, different from development
CLIENT_URL     https://your-frontend.vercel.app
NODE_ENV       production
GEMINI_API_KEY (or GROQ_API_KEY / OPENAI_API_KEY)
```

`CLIENT_URL` accepts a comma-separated list if you need preview deployments too.
Build command `npm install`, start command `npm start`.

---

## Layout

```
server/
├── server.js                 boot, graceful shutdown
└── src/
    ├── config/               env validation, Mongo connection
    ├── models/               User · Room · Message
    ├── controllers/          one per resource
    ├── routes/               thin — middleware + controller
    ├── middleware/           auth, rate limits, error handler
    ├── services/             aiService · chatService · botService
    ├── socket/
    │   ├── socketAuth.js     JWT on the handshake
    │   └── handlers/         presence · message · typing · readReceipt · ai · notes
    ├── scripts/              seed · devLocal · smoke
    └── app.js                Express wiring
```
