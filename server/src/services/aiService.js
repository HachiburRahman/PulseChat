import { env } from '../config/env.js'

/**
 * Provider-agnostic wrapper around whichever LLM you point it at. Switching
 * providers means changing AI_PROVIDER in .env — nothing else in the codebase
 * knows which one is in use.
 *
 * Deliberately built on `fetch` rather than a vendor SDK: streaming is just
 * server-sent events, the shape is stable, and there is no SDK to keep current.
 */

const SYSTEM_PROMPT = `You are ${env.botName}, a helpful assistant living inside a real-time chat app.

- Answer in markdown. Use fenced code blocks with a language tag for code.
- Be concise and concrete. Prefer a short answer plus an example over an essay.
- You can see the recent messages of this conversation; use them for context but
  do not repeat them back.
- If you are unsure, say so plainly rather than inventing details.`

const PROVIDERS = {
  gemini: {
    key: () => env.ai.geminiKey,
    model: () => env.ai.geminiModel,
    label: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
  },
  groq: {
    key: () => env.ai.groqKey,
    model: () => env.ai.groqModel,
    label: 'Groq',
    envVar: 'GROQ_API_KEY',
  },
  openai: {
    key: () => env.ai.openaiKey,
    model: () => env.ai.openaiModel,
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
  },
}

function activeProvider() {
  const provider = PROVIDERS[env.ai.provider]
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${env.ai.provider}". Use one of: ${Object.keys(PROVIDERS).join(', ')}.`,
    )
  }
  return provider
}

export function aiConfigured() {
  try {
    return Boolean(activeProvider().key())
  } catch {
    return false
  }
}

export function aiUnavailableReason() {
  const provider = PROVIDERS[env.ai.provider]
  if (!provider) return `AI_PROVIDER "${env.ai.provider}" is not a provider I know.`
  return `The assistant is not configured — add ${provider.envVar} to server/.env and restart.`
}

/* ── server-sent events ────────────────────────────────────────────── */

/** Yields each `data:` payload from an SSE response body, line-buffered. */
async function* sseEvents(body) {
  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true })

    let cut
    while ((cut = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, cut).trim()
      buffer = buffer.slice(cut + 1)
      if (line.startsWith('data:')) yield line.slice(5).trim()
    }
  }

  const tail = buffer.trim()
  if (tail.startsWith('data:')) yield tail.slice(5).trim()
}

async function failFrom(response, label) {
  const detail = await response.text().catch(() => '')
  let hint = ''

  if (response.status === 401 || response.status === 403) {
    hint = ' — check the API key.'
  } else if (response.status === 429) {
    // "limit: 0" is not throttling, it means this model has no free-tier
    // allowance on that project. Waiting will never help; the model has to change.
    hint = /limit:\s*0\b/.test(detail)
      ? ` — this model has no free-tier quota on your account. Set GEMINI_MODEL=gemini-flash-latest in server/.env.`
      : ' — quota exceeded for now, try again shortly.'
  } else if (response.status === 404) {
    hint = ' — that model id no longer exists. Prefer the `-latest` alias over a pinned version.'
  }

  const error = new Error(`${label} returned ${response.status}${hint}`)
  error.detail = detail.slice(0, 500)
  error.expected = true
  return error
}

/* ── request builders ──────────────────────────────────────────────── */

function buildGemini({ key, model, messages, stream }) {
  const system = messages.find((m) => m.role === 'system')
  const turns = messages.filter((m) => m.role !== 'system')

  return {
    url:
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:` +
      (stream ? 'streamGenerateContent?alt=sse' : 'generateContent'),
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system.content }] } : undefined,
        contents: turns.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: env.ai.maxOutputTokens, temperature: 0.7 },
      }),
    },
    // Gemini nests the text a few levels down and may split it across parts.
    pluck: (json) =>
      json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '',
  }
}

/** Groq speaks the OpenAI chat-completions dialect, so one builder covers both. */
function buildOpenAiLike({ key, model, messages, stream, baseUrl }) {
  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        stream,
        max_tokens: env.ai.maxOutputTokens,
        temperature: 0.7,
      }),
    },
    pluck: (json) =>
      stream
        ? (json?.choices?.[0]?.delta?.content ?? '')
        : (json?.choices?.[0]?.message?.content ?? ''),
  }
}

function buildRequest({ messages, stream }) {
  const provider = activeProvider()
  const key = provider.key()
  if (!key) {
    const error = new Error(aiUnavailableReason())
    error.expected = true
    throw error
  }

  const common = { key, model: provider.model(), messages, stream }

  switch (env.ai.provider) {
    case 'gemini':
      return { ...buildGemini(common), label: provider.label }
    case 'groq':
      return {
        ...buildOpenAiLike({ ...common, baseUrl: 'https://api.groq.com/openai/v1' }),
        label: provider.label,
      }
    case 'openai':
      return {
        ...buildOpenAiLike({ ...common, baseUrl: 'https://api.openai.com/v1' }),
        label: provider.label,
      }
    default:
      throw new Error(`Unhandled provider ${env.ai.provider}`)
  }
}

/* ── public API ────────────────────────────────────────────────────── */

/**
 * Streams a reply, handing each chunk to `onChunk` as it arrives, and resolves
 * with the full concatenated answer once the provider is done.
 *
 * @param {{role: 'system'|'user'|'assistant', content: string}[]} messages
 * @param {(chunk: string) => void} onChunk
 */
export async function streamAiReply(messages, onChunk, { signal } = {}) {
  const { url, init, pluck, label } = buildRequest({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    stream: true,
  })

  const response = await fetch(url, { ...init, signal })
  if (!response.ok || !response.body) throw await failFrom(response, label)

  let full = ''
  for await (const data of sseEvents(response.body)) {
    if (data === '[DONE]') break

    let json
    try {
      json = JSON.parse(data)
    } catch {
      continue // keep-alive comments and partial frames
    }

    const text = pluck(json)
    if (!text) continue

    full += text
    onChunk?.(text)
  }

  if (!full.trim()) throw new Error(`${label} returned an empty response.`)
  return full
}

/** Non-streaming variant behind `POST /api/ai/chat`. */
export async function generateAiReply(messages, { signal } = {}) {
  const { url, init, pluck, label } = buildRequest({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    stream: false,
  })

  const response = await fetch(url, { ...init, signal })
  if (!response.ok) throw await failFrom(response, label)

  const text = pluck(await response.json())
  if (!text?.trim()) throw new Error(`${label} returned an empty response.`)
  return text
}
