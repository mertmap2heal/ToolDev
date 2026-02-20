import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const count = await prisma.user.count()
    console.log('Total users in DB:', count)
}

main().finally(() => prisma.$disconnect())
