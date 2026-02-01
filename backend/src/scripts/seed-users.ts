import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERS = [
  { email: 'mert.caferoglu', name: 'Mert Caferoglu', password: 'Mmcf_6378' },
  { email: 'christian.mandle', name: 'Christian Mandle', password: 'mandle1998' },
]

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
  } catch (error) {
    console.error('Error seeding users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedUsers()
