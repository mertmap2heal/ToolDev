
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const count = await prisma.verMoc.count()
    console.log('Total MoC records:', count)

    const mocs = await prisma.verMoc.findMany()
    console.log('MoC records:', mocs)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
