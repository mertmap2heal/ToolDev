import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const testPassword = process.env.CHECK_PASSWORD
  if (!testPassword) {
    console.error('Error: CHECK_PASSWORD environment variable is not set.')
    console.error('Usage: CHECK_PASSWORD=yourpassword npx ts-node src/scripts/check-password.ts')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email: 'mert.caferoglu' },
    select: { email: true, password: true },
  })
  if (!user) {
    console.log('User mert.caferoglu not found.')
    return
  }
  const matches = await bcrypt.compare(testPassword, user.password)
  console.log('Stored password hash matches provided password:', matches)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
