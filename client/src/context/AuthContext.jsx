import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import { STORAGE, DEMO_MODE } from '@/utils/constants'
import { AuthContext } from './contexts'

const readToken = () => {
  try {
    return localStorage.getItem(STORAGE.token)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(readToken)
  const [booting, setBooting] = useState(Boolean(readToken()))

  /** Restore the session on a hard refresh before anything else renders. */
  useEffect(() => {
    // No token means `booting` already initialised to false — nothing to restore.
    if (!token) return
    let cancelled = false
    api
      .me()
      .then((data) => {
        if (!cancelled) setUser(data.user ?? data)
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem(STORAGE.token)
        setToken(null)
        setUser(null)
      })
      .finally(() => !cancelled && setBooting(false))
    return () => {
      cancelled = true
    }
    // Runs once — a later token change always comes with a user already set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback((data) => {
    const nextUser = data.user ?? data
    localStorage.setItem(STORAGE.token, data.token)
    setToken(data.token)
    setUser(nextUser)
    return nextUser
  }, [])

  const login = useCallback((creds) => api.login(creds).then(persist), [persist])
  const register = useCallback((payload) => api.register(payload).then(persist), [persist])

  const updateProfile = useCallback(async (payload) => {
    const data = await api.updateProfile(payload)
    setUser((prev) => ({ ...prev, ...(data.user ?? data) }))
    return data.user ?? data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE.token)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, booting, demo: DEMO_MODE, login, register, logout, updateProfile }),
    [user, token, booting, login, register, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
