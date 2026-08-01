import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    isAi: { type: Boolean, default: false },
    content: { type: String, required: true, maxlength: 8000 },
    fileName: { type: String, trim: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true, toJSON: { transform: (_doc, ret) => (delete ret.__v, ret) } },
)

/**
 * The index that makes paginated history cheap: "last N messages in this room
 * before this timestamp" becomes a range scan instead of a collection scan.
 */
messageSchema.index({ room: 1, createdAt: -1 })

// Backs the unread-count aggregation on GET /api/rooms.
messageSchema.index({ room: 1, readBy: 1 })

export const Message = mongoose.model('Message', messageSchema)
