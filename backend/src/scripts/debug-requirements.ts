
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Fetching all requirements...')
    const requirements = await prisma.requirement.findMany({
        select: {
            id: true,
            requirementId: true,
            projectId: true,
            title: true,
            status: true
        }
    })

    console.log(`Found ${requirements.length} requirements.`)
    if (requirements.length === 0) {
        console.log('No requirements found.')
    } else {
        // Group by project
        const byProject = requirements.reduce((acc, req) => {
            acc[req.projectId] = acc[req.projectId] || []
            acc[req.projectId].push(req)
            return acc
        }, {} as Record<string, typeof requirements>)

        for (const [projectId, reqs] of Object.entries(byProject)) {
            console.log(`\nProject: ${projectId}`)
            reqs.forEach(r => {
                console.log(`  - [${r.requirementId}] ${r.title} (Status: ${r.status})`)
            })

            // Calculate what the generation logic would produce
            const prefix = 'REQ'
            let maxNumber = 0
            for (const req of reqs) {
                if (req.requirementId) {
                    const match = req.requirementId.match(/-(\d+)$/)
                    if (match) {
                        const num = parseInt(match[1], 10)
                        if (num > maxNumber) maxNumber = num
                    }
                }
            }
            console.log(`  > Calculated Max Number: ${maxNumber}`)
            console.log(`  > Next ID should be: ${prefix}-${(maxNumber + 1).toString().padStart(3, '0')}`)
        }
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
