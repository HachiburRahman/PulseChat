import http from './axios'
import { DEMO_MODE, PAGE_SIZE } from '@/utils/constants'
import { mockApi } from '@/mock/mockApi'

/**
 * Every REST call the UI makes, in one place. Each method mirrors an endpoint
 * from the blueprint's API table, so swapping demo mode off is a no-op for
 * every component that consumes this module.
 */
const liveApi = {
  register: (payload) => http.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => http.post('/auth/login', payload).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),

  updateProfile: (payload) => http.put('/users/profile', payload).then((r) => r.data),
  listUsers: () => http.get('/users').then((r) => r.data),

  listRooms: () => http.get('/rooms').then((r) => r.data),
  createRoom: (payload) => http.post('/rooms', payload).then((r) => r.data),
  openDm: (userId) => http.post(`/rooms/dm/${userId}`).then((r) => r.data),

  history: (roomId, { before, limit = PAGE_SIZE } = {}) =>
    http.get(`/messages/${roomId}`, { params: { before, limit } }).then((r) => r.data),

  /** Non-streaming fallback, used if the socket AI path is unavailable. */
  askAi: (payload) => http.post('/ai/chat', payload).then((r) => r.data),

  /** Tells the UI whether a provider key is configured, and why not if it isn't. */
  aiStatus: () => http.get('/ai/status').then((r) => r.data),

  /** Bulk read receipt — used when opening a room with a backlog. */
  markRoomRead: (roomId) => http.patch(`/messages/${roomId}/read`).then((r) => r.data),
}

export const api = DEMO_MODE ? mockApi : liveApi
export { liveApi }
