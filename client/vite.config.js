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
/**
 * Describe what is wrong with one URL variable without ever echoing its value.
 *
 * Hosts scrub environment-variable values from build logs, so quoting the value
 * back prints as `[REDACTED]` and teaches nothing. The URL's *path* (`/`, `/api`)
 * and its length are short, non-secret facts that survive redaction and pin down
 * which of the three silent failures this is: not set, wrong path, or pasted
 * with the quotes still attached.
 */
function checkUrlVar(name, rawValue, { wantApiSuffix }) {
  const shape = wantApiSuffix ? 'https://<your-api-host>/api' : 'https://<your-api-host>'
  const value = rawValue?.trim()

  if (!value) return `${name} is not set for this build.\n    Set it to ${shape}`

  // A value pasted with its quotes stores the quotes as part of the string.
  // The dashboard shows what looks like a correct URL, and nothing works.
  if (/^["'].*["']$/.test(value)) {
    return (
      `${name} has quote characters wrapping its value.\n` +
      `    The host stores them as part of the string. Remove the surrounding\n` +
      `    " or ' so the value is bare: ${shape}`
    )
  }

  let url
  try {
    url = new URL(value)
  } catch {
    return (
      `${name} is not a valid URL (${value.length} characters, no scheme?).\n` +
      `    It must look like ${shape}`
    )
  }

  const endsWithApi = /\/api\/?$/.test(url.pathname)

  if (wantApiSuffix && !endsWithApi) {
    return (
      `${name} points at path "${url.pathname}" but every route is mounted under /api.\n` +
      `    Append /api so the path reads "/api" — ${shape}`
    )
  }
  if (!wantApiSuffix && endsWithApi) {
    return (
      `${name} points at path "${url.pathname}", but Socket.io connects to the origin.\n` +
      `    Remove the /api suffix — ${shape}`
    )
  }
  return null
}

function assertDeployEnv(env) {
  const problems = [
    checkUrlVar('VITE_API_URL', env.VITE_API_URL, { wantApiSuffix: true }),
    checkUrlVar('VITE_SOCKET_URL', env.VITE_SOCKET_URL, { wantApiSuffix: false }),
  ].filter(Boolean)

  if (!problems.length) return

  /**
   * Name the environment this build ran in. Vercel scopes variables to
   * Production / Preview / Development separately, so a variable set for only
   * one of them looks correct in the dashboard while the other keeps failing —
   * and nothing on screen says which build you are looking at.
   */
  const context = process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'
  const seen = Object.keys(process.env)
    .filter((k) => k.startsWith('VITE_'))
    .sort()

  // Print and exit rather than throw: Vite wraps a thrown config error in a
  // stack trace, and in a Vercel build log the useful lines scroll past while
  // the trace makes a deliberate check look like a crash.
  console.error(
    `\n✖ Cannot build: the deployment environment is incomplete.\n\n` +
      problems.map((p) => `  • ${p}`).join('\n') +
      `\n\n  This build ran in the "${context}" environment and received these\n` +
      `  VITE_ variables: ${seen.length ? seen.join(', ') : '(none)'}\n\n` +
      `  On Vercel a variable is scoped per environment. If the name you expect\n` +
      `  is missing above, it exists but is not ticked for "${context}":\n` +
      `  Settings → Environment Variables → edit → tick every environment.\n` +
      `  Values are baked in at build time, so redeploy after changing one.\n\n` +
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
