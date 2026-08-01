import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A display name is required'],
      trim: true,
      maxlength: [60, 'That name is too long'],
    },
    email: {
      type: String,
      // `sparse` lets the bot exist without an email while humans stay unique.
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'That email does not look right'],
    },
    password: {
      type: String,
      select: false, // never leaves the database unless explicitly asked for
      minlength: [8, 'Use at least 8 characters'],
    },
    avatarUrl: { type: String, default: '' },
    isBot: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password
        delete ret.__v
        return ret
      },
    },
  },
)

/**
 * Hash on the way in, so a plaintext password never touches the collection.
 * Mongoose 9 drops the `next` callback for async middleware — returning is the
 * signal that the hook is finished.
 */
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.matchesPassword = function matchesPassword(candidate) {
  if (!this.password) return false
  return bcrypt.compare(candidate, this.password)
}

/** The projection every populated `sender` / `members` entry uses. */
export const PUBLIC_USER_FIELDS = 'name email avatarUrl isBot isOnline lastSeen'

export const User = mongoose.model('User', userSchema)
