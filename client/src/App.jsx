import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import { ChatProvider } from '@/context/ChatContext'
import { ProtectedRoute, BootScreen } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { ROUTES } from '@/utils/constants'

const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Chat = lazy(() => import('@/pages/Chat'))
const AiChat = lazy(() => import('@/pages/AiChat'))
const Profile = lazy(() => import('@/pages/Profile'))
const NotesRoom = lazy(() => import('@/pages/NotesRoom'))
const NotFound = lazy(() => import('@/pages/NotFound'))

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <ChatProvider>
              <Suspense fallback={<BootScreen />}>
                <Routes>
                  <Route path={ROUTES.login} element={<Login />} />
                  <Route path={ROUTES.register} element={<Register />} />

                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<Chat />} />
                    <Route path="/chat/:roomId" element={<Chat />} />
                    <Route path="/ai" element={<AiChat />} />
                    <Route path="/notes/:roomId" element={<NotesRoom />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>

                  <Route path="/chat" element={<Navigate to={ROUTES.chat} replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ChatProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
