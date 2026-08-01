# PulseChat — client

The React SPA half of PulseChat: rooms, direct messages, live presence, typing
indicators, read receipts, and an AI assistant whose replies stream in token by
token over the socket.

Built with **React 19 · Vite · Tailwind CSS v4 · React Router 7 · socket.io-client ·
Firebase Storage · react-markdown**.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. It runs immediately — no backend required, see below.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built output |
| `npm run lint` | ESLint over `src/` |

---

> The server this talks to lives in [`../server`](../server). Start it with
> `npm run start:local` there and the client works with no other setup.

## Demo mode

`VITE_DEMO_MODE=true` swaps two modules for in-memory fakes that speak the
**exact same contract** as the real thing. It is strictly opt-in: unset, or any
value other than `true`, means the app talks to the real API. That way a deploy
that forgets the variable fails visibly rather than quietly serving fixtures.

- `src/mock/mockApi.js` stands in for the REST client
- `src/mock/mockSocket.js` stands in for the socket.io client

Fixtures include six users, an AI bot, three rooms, two DMs, an AI conversation,
seeded unread counts, simulated latency, drifting presence, an ambient incoming
message and a canned streaming AI reply. Every loading state, skeleton and empty
state is exercised.

A **DEMO** chip in the sidebar makes it obvious you are not on real data.

It is off by default now that the backend exists — flip it back on if you ever
want to work on the UI without a server running. Nothing else changes; no
component imports the mocks directly.

### Environment

Copy `.env.example` to `.env`:

```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_DEMO_MODE=true
VITE_FIREBASE_API_KEY=…          # optional, for image/file sharing
VITE_FIREBASE_AUTH_DOMAIN=…
VITE_FIREBASE_PROJECT_ID=…
VITE_FIREBASE_STORAGE_BUCKET=…
VITE_FIREBASE_APP_ID=…
```

Without Firebase credentials, uploads fall back to a local object-URL preview so
the upload UI stays testable. **Never put the AI provider key here** — it belongs
in `server/.env` only.

---

## What the client expects from the backend

### REST — `src/api/index.js`

| Method | Endpoint | Response the client accepts |
| --- | --- | --- |
| POST | `/auth/register` | `{ token, user }` |
| POST | `/auth/login` | `{ token, user }` |
| GET | `/auth/me` | `{ user }` or the user object |
| PUT | `/users/profile` | `{ user }` or the user object |
| GET | `/users` | `{ users }` or an array |
| GET | `/rooms` | `{ rooms }` or an array |
| POST | `/rooms` | `{ room }` or the room object |
| POST | `/rooms/dm/:userId` | `{ room }` or the room object |
| GET | `/messages/:roomId?before&limit` | `{ messages, hasMore }` or an array |
| PATCH | `/messages/:roomId/read` | `{ updated }` — clears a backlog in one call |
| POST | `/ai/chat` | `{ message }` — non-streaming fallback |
| GET | `/ai/status` | `{ configured, provider, reason }` |

Every list endpoint tolerates both a bare array and a `{ key: [...] }` wrapper, so
the UI is not brittle about which shape it gets.

**Two things the UI uses when present** (both implemented in `../server`):

- `room.unread` on `GET /rooms` — seeds the unread badges on first load. Without
  it, badges only count messages that arrive while the tab is open.
- `message.tempId` echoed back on `receive_message` — lets the client reconcile an
  optimistic bubble precisely. Without it, it falls back to matching on sender +
  content, which works but is fuzzier.

### Socket events — `src/utils/constants.js`

Client → server: `join_room`, `send_message`, `ai_message`, `typing`,
`stop_typing`, `mark_read`.

Server → client: `receive_message`, `ai_typing`, `ai_stream`, `ai_done`, `typing`,
`stop_typing`, `presence_update`, `message_read`, `error`.

The JWT rides in the handshake — `io(URL, { auth: { token } })` — so `io.use()` can
verify it once per connection.

`ai_message` is wired to the **Regenerate** button; ordinary questions go through
`send_message` so the user's prompt is persisted and broadcast first, exactly as
the blueprint describes.

`error` carries a `roomId` when the failure belongs to a conversation — that is
what lets a failed AI reply clear its "thinking…" state instead of spinning
forever.

**One event beyond the blueprint,** used by the notes room:

```
client → server   note_update  { roomId, content }
server → client   note_update  { roomId, content, user }   (broadcast to the room)
```

`typing` is re-announced on a 2s heartbeat while you keep typing, because
receivers expire a stale indicator after 5s — one event per burst would drop the
indicator halfway through a long sentence.

---

## Design system — "Signal"

A dark instrument-panel aesthetic. The chassis is near-black; **you** are an acid
lime trace, **the machine** is warm amber, **presence** is mint. In light mode the
palette inverts rather than washing out — your own bubbles become near-black with
lime text, so the signature survives the theme switch.

| | |
| --- | --- |
| Display | **Bricolage Grotesque** — headings, names, wordmark |
| Body | **Instrument Sans** — message text, UI copy |
| Mono | **DM Mono** — timestamps, status labels, code blocks |

All tokens live in `src/index.css` as CSS variables, exposed to Tailwind through
`@theme inline` so a single `.dark` class flips the whole app:

`--bg` `--elev` `--surface` `--line` `--ink` `--ink-2` `--ink-3` `--signal`
`--self-bg` `--self-ink` `--ai` `--online` `--danger`

Text colours are checked against WCAG AA in both themes (body ≥ 15:1, muted
metadata ≥ 4.5:1, accents ≥ 4.7:1).

**The recurring motif is the waveform.** The logo traces a heartbeat on a loop;
the typing indicator is a level meter rather than three dots; the AI stream ends
in a blinking block cursor; presence dots pulse a halo; the chat header grows a
signal strip while someone is typing. Atmosphere comes from a grain overlay, a
faint instrument grid and a slow-drifting colour bloom.

Motion respects `prefers-reduced-motion`.

---

## Structure

```
src/
├── api/          axios instance + every REST call in one module
├── socket/       creates the one shared socket (real or mock)
├── firebase/     Storage upload with graceful local fallback
├── context/      contexts.js + Theme / Auth / Socket / Chat providers
├── hooks/        useAuth · useSocket · useChat · useTheme · useAutoScroll
├── mock/         demo-mode fixtures, fake REST client, fake socket
├── components/   Sidebar · ChatWindow · MessageList · MessageBubble · …
│   └── ui/       Button · Field · Modal · Toast · Skeleton · EmptyState
├── pages/        Login · Register · Chat · AiChat · Profile · NotesRoom · NotFound
└── utils/        constants (incl. the socket contract) · formatters · cn
```

`ChatContext` is the brain: rooms, per-room message caches, cursor pagination,
presence, typing maps, AI stream buffers, unread counts and optimistic sends.
Components stay presentational.

### Notes on a few decisions

- **One socket, created in an effect, not a lazy `useState`.** StrictMode
  double-invokes lazy initialisers, which would open two connections and leak one.
- **Auto-scroll only when already at the bottom.** Scroll up to read history and
  new messages stop yanking you down; a "Jump to latest" pill takes over.
- **Scroll position is anchored when older messages prepend**, so loading page two
  does not throw you back to the top.
- **Typing is debounced** — one `typing` on the first keystroke, `stop_typing`
  after 1.4 s idle — with a sweeper that clears indicators if a `stop_typing` is
  ever lost.
- **Drafts persist per room** via a `key={roomId}` remount rather than an effect.

---

## Responsive behaviour

| Width | Layout |
| --- | --- |
| `< 1024px` | Conversation list and chat are two screens; navigation lives in the sidebar |
| `≥ 1024px` | Icon rail + conversation list + chat pane, all visible at once |

Wide content — code blocks, tables — scrolls inside its own container; the page
body never scrolls horizontally.

---

## The other half

[`../server`](../server) — Express, JWT, Mongoose on MongoDB Atlas, Socket.io and
the streaming AI service. Its smoke suite asserts the contract above from the
other side.
