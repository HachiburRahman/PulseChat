import { createContext } from 'react'

/**
 * The context objects live here, apart from the providers that fill them and
 * the hooks that read them. Keeping non-component exports out of the `.jsx`
 * provider files is what lets Vite fast-refresh survive an edit to either one.
 */
export const ThemeContext = createContext(null)
export const AuthContext = createContext(null)
export const SocketContext = createContext(null)
export const ChatContext = createContext(null)
