import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { aiConfigured, aiUnavailableReason, generateAiReply } from '../services/aiService.js'
import { buildAiContext, roomForMember, saveMessage } from '../services/chatService.js'
import { getBot } from '../services/botService.js'
import { env } from '../config/env.js'

/**
 * POST /api/ai/chat  🔒
 *
 * The simple, non-streaming path. The socket route (`ai_message` →
 * `ai_stream` → `ai_done`) is what the UI normally uses; this exists as the
 * fallback and as the easier thing to test with curl.
 *
 * Body: { roomId, prompt }
 */
export const chat = asyncHandler(async (req, res) => {
  if (!aiConfigured()) throw new ApiError(503, aiUnavailableReason())

  const prompt = String(req.body.prompt || '').trim()
  if (!prompt) throw ApiError.badRequest('Ask the assistant something')
  if (prompt.length > 4000) throw ApiError.badRequest('That prompt is too long')

  const { roomId } = req.body
  const bot = await getBot()

  // Roomless mode: answer without persisting anything.
  if (!roomId) {
    const answer = await generateAiReply([{ role: 'user', content: prompt }])
    return res.json({
      message: {
        _id: null,
        sender: bot.toJSON(),
        isAi: true,
        type: 'text',
        content: answer,
        createdAt: new Date().toISOString(),
      },
    })
  }

  await roomForMember(roomId, req.user._id)

  // Persist the question first, so the transcript reads correctly either way.
  await saveMessage({ roomId, senderId: req.user._id, content: prompt })

  const context = await buildAiContext(roomId, { prompt, limit: env.ai.contextMessages })
  const answer = await generateAiReply(context)

  const message = await saveMessage({
    roomId,
    senderId: bot._id,
    content: answer,
    isAi: true,
  })

  res.json({ message: message.toJSON() })
})

/** GET /api/ai/status — lets the client explain *why* the assistant is quiet. */
export const status = asyncHandler(async (_req, res) => {
  res.json({
    configured: aiConfigured(),
    provider: env.ai.provider,
    reason: aiConfigured() ? null : aiUnavailableReason(),
  })
})
