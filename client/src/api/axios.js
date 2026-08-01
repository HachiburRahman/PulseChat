import axios from 'axios'
import { API_URL, STORAGE } from '@/utils/constants'

const http = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE.token)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status

    // An expired or tampered JWT: drop it and bounce to the login screen.
    if (status === 401 && !error.config?.url?.includes('/auth/')) {
      localStorage.removeItem(STORAGE.token)
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
    }

    return Promise.reject(
      Object.assign(error, {
        friendly:
          error.response?.data?.message ||
          (error.code === 'ERR_NETWORK'
            ? 'Cannot reach the server. Is the API running?'
            : 'Something went wrong. Please try again.'),
      }),
    )
  },
)

export default http
