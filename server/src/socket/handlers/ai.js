import { env } from '../../config/env.js'
import { aiConfigured, aiUnavailableReason, streamAiReply } from '../../services/aiService.js'
import {
  buildAiContext,
  roomForMember,
  saveMessage,
  stripAiTrigger,
} from '../../services/chatService.js'
import { getBot } from '../../services/botService.js'

/** Only one answer in flight per room — a second `@ai` waits its turn. */
const streaming = new Set()

/** Per-user hourly budget, so a public demo cannot drain the provider quota. */
const usage = new Map() // userId → { count, resetAt }

function withinBudget(userId) {
  const now = Date.now()
  const record = usage.get(userId)

  if (!record || now > record.resetAt) {
    usage.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (record.count >= env.ai.requestsPerHour) return false

  record.count += 1
  return true
}

/**
 * The headline flow:
 *   ai_typing  →  ai_stream × n  →  ai_done
 */
export async function runAiReply(io, { room, prompt, requesterId }) {
  const roomId = String(room._id)

  if (streaming.has(roomId)) {
    io.to(roomId).emit('error', {
      roomId,
      message: 'The assistant is still answering the previous question.',
    })
    return
  }

  if (!aiConfigured()) {
    io.to(roomId).emit('error', { roomId, message: aiUnavailableReason() })
    return
  }

  if (!withinBudget(String(requesterId))) {
    io.to(roomId).emit('error', {
      roomId,
      message: 'You have hit the hourly AI limit. Try again later.',
    })
    return
  }

  streaming.add(roomId)
  io.to(roomId).emit('ai_typing', { roomId })

  try {
    const bot = await getBot()
    const context = await buildAiContext(room._id, { prompt, limit: env.ai.contextMessages })

    /**
     * Relay each provider chunk as it lands, rather than coalescing on a timer.
     *
     * Coalescing looked like the careful choice, but a short answer arrives in
     * one burst before any interval can fire, so the whole reply shipped as a
     * single frame and the bubble snapped to full text with no typing effect —
     * which is the one thing this feature exists to show. Providers emit tens of
     * chunks per reply, not thousands, so a frame each is well within budget.
     */
    const answer = await streamAiReply(context, (chunk) => {
      io.to(roomId).emit('ai_stream', { roomId, chunk })
    })

    const message = await saveMessage({
      roomId: room._id,
      senderId: bot._id,
      content: answer,
      isAi: true,
    })

    io.to(roomId).emit('ai_done', { message: message.toJSON() })
  } catch (err) {
    console.error('AI reply failed:', err.message, err.detail || '')
    io.to(roomId).emit('error', {
      roomId,
      message: err.expected
        ? err.message
        : 'The assistant is unavailable right now. Please try again.',
    })
  } finally {
    streaming.delete(roomId)
  }
}

/** `ai_message` — ask directly, without posting a question into the room first. */
export function registerAiHandlers(io, socket) {
  socket.on('ai_message', async ({ roomId, prompt } = {}) => {
    try {
      const text = stripAiTrigger(String(prompt || ''))
      if (!text) return
      if (text.length > 4000) {
        return socket.emit('error', { roomId, message: 'That prompt is too long.' })
      }

      const room = await roomForMember(roomId, socket.user._id)

      await runAiReply(io, { room, prompt: text, requesterId: socket.userId })
    } catch (err) {
      socket.emit('error', { roomId, message: err.message || 'Could not reach the assistant' })
    }
  })
}
