import { prisma } from '../lib/prisma'


async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      inviteEmail: true,
      name: true,
      lastLoginAt: true,
      mustChangePasswordOnFirstLogin: true,
    },
    orderBy: { email: 'asc' },
  })
  console.log(JSON.stringify(users, null, 2))
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
