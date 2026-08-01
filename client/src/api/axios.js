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

    // No `response` at all means the request never got a reply: the API is
    // down, the URL is wrong, DNS failed, or CORS blocked it. Checking for a
    // missing response covers all of those; `code === 'ERR_NETWORK'` alone
    // misses DNS failures, which is exactly how a bad VITE_API_URL presents.
    return Promise.reject(
      Object.assign(error, {
        friendly:
          error.response?.data?.message ||
          (error.response
            ? 'Something went wrong. Please try again.'
            : 'Cannot reach the server. Check that the API is running and that VITE_API_URL points at it.'),
      }),
    )
  },
)

export default http
