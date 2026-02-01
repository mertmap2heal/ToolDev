import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Seed default users for development/login
 * Run with: npm run seed:users
 */
async function seedUsers() {
  try {
    const hashedPassword = await bcrypt.hash('Mmcf_6378', 10)

    const user = await prisma.user.upsert({
      where: { email: 'mmertcaferoglu' },
      update: { password: hashedPassword, name: 'Mmert Caferoglu' },
      create: {
        email: 'mmertcaferoglu',
        name: 'Mmert Caferoglu',
        password: hashedPassword,
      },
    })

    console.log(`User seeded: ${user.email} (${user.name})`)
  } catch (error) {
    console.error('Error seeding users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedUsers()
