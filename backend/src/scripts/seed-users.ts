import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Seed default users for development/login
 * Run with: npm run seed:users
 *
 * Required env vars (set in backend/.env or shell):
 *   SEED_PASSWORD_MERT       - password for mert.caferoglu
 *   SEED_PASSWORD_CHRISTIAN  - password for christian.mandle
 *   SEED_PASSWORD_ADMIN      - password for admin (platform admin)
 */
async function seedUsers() {
  // Fail fast if any seed password env var is missing — never seed with placeholder passwords
  const missing = ['SEED_PASSWORD_MERT', 'SEED_PASSWORD_CHRISTIAN', 'SEED_PASSWORD_ADMIN']
    .filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`Error: required env var(s) not set: ${missing.join(', ')}`)
    console.error('Set them in backend/.env or your shell before running seed:users')
    process.exit(1)
  }

  // Defined after pre-flight: env vars are guaranteed to be set at this point
  const USERS = [
    {
      email: 'mert.caferoglu',
      name: 'Mert Caferoglu',
      password: process.env.SEED_PASSWORD_MERT as string,
    },
    {
      email: 'christian.mandle',
      name: 'Christian Mandle',
      password: process.env.SEED_PASSWORD_CHRISTIAN as string,
    },
  ]

  /** Superior Admin (Platform Owner) - same login, redirects to /platform-admin */
  const SUPERIOR_ADMIN = {
    email: 'admin',
    name: 'Platform Admin',
    password: process.env.SEED_PASSWORD_ADMIN as string,
    role: 'SUPERIOR_ADMIN' as const,
  }

  try {
    for (const u of USERS) {
      const hashedPassword = await bcrypt.hash(u.password, 10)
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: { password: hashedPassword, name: u.name },
        create: {
          email: u.email,
          name: u.name,
          password: hashedPassword,
        },
      })
      console.log(`User seeded: ${user.email} (${user.name})`)
    }

    const adminHash = await bcrypt.hash(SUPERIOR_ADMIN.password, 10)
    const adminUser = await prisma.user.upsert({
      where: { email: SUPERIOR_ADMIN.email },
      update: { password: adminHash, name: SUPERIOR_ADMIN.name, role: SUPERIOR_ADMIN.role },
      create: {
        email: SUPERIOR_ADMIN.email,
        name: SUPERIOR_ADMIN.name,
        password: adminHash,
        role: SUPERIOR_ADMIN.role,
      },
    })
    console.log(`Superior Admin seeded: ${adminUser.email} (${adminUser.name})`)
  } catch (error) {
    console.error('Error seeding users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedUsers()
