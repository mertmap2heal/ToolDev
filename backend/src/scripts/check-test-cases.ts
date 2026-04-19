
import { prisma } from '../lib/prisma'


async function main() {
    const projects = await prisma.project.findMany()
    console.log(`Found ${projects.length} projects`)

    for (const p of projects) {
        const testCases = await prisma.verTestCase.count({ where: { projectId: p.id } })
        const testPlans = await prisma.verTestPlan.count({ where: { projectId: p.id } })
        console.log(`Project ${p.id} (${p.name}): ${testCases} Test Cases, ${testPlans} Test Plans`)
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
