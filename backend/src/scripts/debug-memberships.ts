
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Users ---')
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
    })
    console.log(users)

    console.log('\n--- Projects ---')
    const projects = await prisma.project.findMany({
        select: { id: true, name: true, userId: true } // userId is the owner
    })
    console.log(projects)

    console.log('\n--- Project Members ---')
    const members = await prisma.projectMember.findMany({
        include: {
            user: { select: { email: true } },
            project: { select: { name: true } }
        }
    })

    // Group members by project
    const membersByProject = members.reduce((acc, m) => {
        acc[m.projectId] = acc[m.projectId] || []
        acc[m.projectId].push(`${m.user.email} (${m.role})`)
        return acc
    }, {} as any)

    for (const p of projects) {
        console.log(`Project: ${p.name} (Owner ID: ${p.userId})`)
        const projMembers = membersByProject[p.id] || []
        console.log(`  Members: ${projMembers.join(', ') || 'None'}`)
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
