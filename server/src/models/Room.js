import mongoose from 'mongoose'

/** One shape covers group channels, 1-on-1 DMs and the AI conversation. */
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 60, default: '' },
    isGroup: { type: Boolean, default: false },
    isAiRoom: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true, toJSON: { transform: (_doc, ret) => (delete ret.__v, ret) } },
)

// "Which rooms am I in, most recently active first" — the sidebar's only query.
roomSchema.index({ members: 1, updatedAt: -1 })

roomSchema.methods.includes = function includes(userId) {
  return this.members.some((member) => String(member._id ?? member) === String(userId))
}

export const Room = mongoose.model('Room', roomSchema)
