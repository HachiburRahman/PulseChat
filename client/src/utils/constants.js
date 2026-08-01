/** Runtime configuration, socket contract and route table. */

const env = import.meta.env

export const API_URL = env.VITE_API_URL || 'http://localhost:5000/api'
export const SOCKET_URL = env.VITE_SOCKET_URL || 'http://localhost:5000'

/**
 * Demo mode swaps the REST client and the socket for in-memory fakes that speak
 * the exact same contract, so the UI is explorable with no backend running.
 * Opt in with `VITE_DEMO_MODE=true`.
 *
 * Opt-in, never opt-out. This used to read `!== 'false'`, which meant a missing
 * variable turned demo mode ON — and a hosting platform starts with no
 * variables at all. A deploy that forgot to set it looked completely healthy
 * while serving fixtures and never once contacting the real API. Failing to a
 * visible connection error beats silently faking the whole product.
 */
export const DEMO_MODE = env.VITE_DEMO_MODE === 'true'

export const STORAGE = {
  token: 'pulsechat.token',
  theme: 'pulsechat.theme',
  draftPrefix: 'pulsechat.draft.',
}

/** Client → Server */
export const EMIT = {
  joinRoom: 'join_room',
  sendMessage: 'send_message',
  aiMessage: 'ai_message',
  typing: 'typing',
  stopTyping: 'stop_typing',
  markRead: 'mark_read',
}

/** Server → Client */
export const ON = {
  receiveMessage: 'receive_message',
  aiTyping: 'ai_typing',
  aiStream: 'ai_stream',
  aiDone: 'ai_done',
  typing: 'typing',
  stopTyping: 'stop_typing',
  presence: 'presence_update',
  messageRead: 'message_read',
  error: 'error',
}

export const ROUTES = {
  login: '/login',
  register: '/register',
  chat: '/',
  room: (id) => `/chat/${id}`,
  ai: '/ai',
  notes: (id) => `/notes/${id}`,
  profile: '/profile',
}

export const PAGE_SIZE = 30

/** How long after the last keystroke we declare you finished typing. */
export const TYPING_DEBOUNCE = 1400

/**
 * While you keep typing, re-announce it on this interval. Receivers expire a
 * stale indicator after 5s, so a long sentence would otherwise stop showing as
 * "typing…" halfway through.
 */
export const TYPING_HEARTBEAT = 2000
export const AI_TRIGGER = '@ai'

/** Deterministic accent per user id — avatars stay stable across sessions. */
export const AVATAR_HUES = [
  '#c6f24e',
  '#ffb067',
  '#4be8a4',
  '#7ad7ff',
  '#ff8fb1',
  '#c2a8ff',
  '#ffd86b',
  '#5ef0d8',
]
