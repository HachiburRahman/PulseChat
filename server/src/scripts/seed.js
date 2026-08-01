import { assertEnv, env } from '../config/env.js'
import { connectDb, disconnectDb } from '../config/db.js'
import { seedDatabase, demoAccountsBanner } from './seedData.js'

/** CLI wrapper: `npm run seed` — fills the configured database with demo data. */

assertEnv()

if (env.isProd && process.argv[2] !== '--force') {
  console.error('✖ Refusing to seed with NODE_ENV=production. Pass --force if you mean it.')
  process.exit(1)
}

try {
  await connectDb()
  const counts = await seedDatabase({ log: console.log })

  console.log(`
✔ Seeded
  ${counts.users} users · ${counts.rooms} rooms · ${counts.messages} messages

${demoAccountsBanner()}
`)
  await disconnectDb()
  process.exit(0)
} catch (err) {
  console.error('✖ Seed failed:', err.message)
  await disconnectDb().catch(() => {})
  process.exit(1)
}
