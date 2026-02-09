import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERS = [
  { email: 'mert.caferoglu', name: 'Mert Caferoglu', password: 'Mmcf_6378' },
  { email: 'christian.mandle', name: 'Christian Mandle', password: 'mandle1998' },
]

/** Superior Admin (Platform Owner) - same login, redirects to /platform-admin */
const SUPERIOR_ADMIN = {
  email: 'admin',
  name: 'Platform Admin',
  password: 'password',
  role: 'SUPERIOR_ADMIN' as const,
}

/**
 * Seed default users for development/login
 * Run with: npm run seed:users
 */
async function seedUsers() {
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
