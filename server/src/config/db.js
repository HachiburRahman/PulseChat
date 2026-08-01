import mongoose from 'mongoose'
import { env } from './env.js'

mongoose.set('strictQuery', true)

export async function connectDb(uri = env.mongoUri) {
  mongoose.connection.on('connected', () =>
    console.log(`✔ MongoDB connected — ${mongoose.connection.name}`),
  )
  mongoose.connection.on('error', (err) => console.error('✖ MongoDB error:', err.message))
  mongoose.connection.on('disconnected', () => console.warn('… MongoDB disconnected'))

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15_000,
      // Atlas' free tier is small; keep the pool modest.
      maxPoolSize: 10,
    })
    return mongoose.connection
  } catch (err) {
    console.error(
      `\n✖ Could not reach MongoDB.\n  ${err.message}\n\n` +
        `  Check that MONGO_URI is set in server/.env, that the password is\n` +
        `  URL-encoded, and that your IP is allowed under Atlas → Network Access.\n`,
    )
    throw err
  }
}

export async function disconnectDb() {
  await mongoose.connection.close()
}
