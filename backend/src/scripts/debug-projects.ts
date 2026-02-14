
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const projects = await prisma.project.findMany()
    console.log('Projects:')
    for (const p of projects) {
        console.log(`- ID: ${p.id}, Name: ${p.key}, Description: ${p.description}`)
        const reqCount = await prisma.requirement.count({ where: { projectId: p.id } })
        console.log(`  Requirements count: ${reqCount}`)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
