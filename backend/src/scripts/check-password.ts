import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'mert.caferoglu' },
    select: { email: true, password: true },
  })
  if (!user) {
    console.log('User mert.caferoglu not found.')
    return
  }
  const matchesSeed = await bcrypt.compare('Mmcf_6378', user.password)
  console.log('Stored password hash matches "Mmcf_6378":', matchesSeed)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
