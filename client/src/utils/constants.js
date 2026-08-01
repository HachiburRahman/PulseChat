/** Runtime configuration, socket contract and route table. */

const env = import.meta.env

export const API_URL = env.VITE_API_URL || 'http://localhost:5000/api'
export const SOCKET_URL = env.VITE_SOCKET_URL || 'http://localhost:5000'

/**
 * Demo mode swaps the REST client and the socket for in-memory fakes that
 * speak the exact same contract, so the whole UI is explorable before the
 * Express/Socket.io server from the blueprint exists. Flip
 * `VITE_DEMO_MODE=false` in `.env` the moment the backend is up.
 */
export const DEMO_MODE = env.VITE_DEMO_MODE !== 'false'

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
