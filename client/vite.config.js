import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Fail the build when the deploy config is wrong, instead of shipping a bundle
 * that quietly points at localhost.
 *
 * Vite bakes VITE_* values in at build time, so a missing or malformed one is
 * invisible until a real user hits it — and then it surfaces as "cannot reach
 * the server", which reads like the backend is down rather than a typo in a
 * dashboard field. Better to break the build, where the message is read.
 */
function assertDeployEnv(env) {
  const problems = []
  const api = env.VITE_API_URL?.trim()
  const socket = env.VITE_SOCKET_URL?.trim()

  if (!api) {
    problems.push('VITE_API_URL is not set. Example: https://your-api.onrender.com/api')
  } else if (!/\/api\/?$/.test(api)) {
    problems.push(
      `VITE_API_URL is "${api}" but must end with /api — every route is mounted there.\n` +
        `    Change it to: ${api.replace(/\/$/, '')}/api`,
    )
  }

  if (!socket) {
    problems.push('VITE_SOCKET_URL is not set. Example: https://your-api.onrender.com')
  } else if (/\/api\/?$/.test(socket)) {
    problems.push(
      `VITE_SOCKET_URL is "${socket}" but must NOT end with /api — Socket.io connects to the origin.\n` +
        `    Change it to: ${socket.replace(/\/api\/?$/, '')}`,
    )
  }

  if (!problems.length) return

  // Print and exit rather than throw: Vite wraps a thrown config error in a
  // stack trace, and in a Vercel build log the useful lines scroll past while
  // the trace makes a deliberate check look like a crash.
  console.error(
    `\n✖ Cannot build: the deployment environment is incomplete.\n\n` +
      problems.map((p) => `  • ${p}`).join('\n') +
      `\n\n  Set these in your host's environment variables (Vercel: Settings →\n` +
      `  Environment Variables), tick every environment, then redeploy.\n` +
      `  Building the demo build instead? Set VITE_DEMO_MODE=true.\n`,
  )
  process.exit(1)
}

export default defineConfig(({ command, mode }) => {
  // Config dir, not cwd — `npm --prefix client run build` runs from the repo root.
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')

  // Demo builds run on fixtures and legitimately need no backend.
  if (command === 'build' && env.VITE_DEMO_MODE !== 'true') assertDeployEnv(env)

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
  }
})
