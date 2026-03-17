
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. Get a project that is NOT the one with REQ-001 (assuming REQ-001 exists)
    // We saw project c15fe021-f2c3-4792-9cc0-0be8ae434a46 has 0 requirements

    const targetProjectId = 'c15fe021-f2c3-4792-9cc0-0be8ae434a46'

    // Verify it exists
    const project = await prisma.project.findUnique({ where: { id: targetProjectId } })
    if (!project) {
        console.log('Target project not found. Trying to find any other project...')
        // Logic to find another project could go here, but for now we rely on previous knowledge
        return
    }

    console.log(`Attempting to create requirement in project ${targetProjectId}...`)

    try {
        const req = await prisma.requirement.create({
            data: {
                projectId: targetProjectId,
                requirementId: 'REQ-001', // Explicitly try to create a DUPLICATE ID vs other project
                title: 'Verification Requirement',
                description: 'Testing if unique constraint is removed',
                priority: 'medium',
                status: 'draft',
                stage: 'init'
            }
        })
        console.log('✅ SUCCESS: Created requirement with ID:', req.requirementId)

        // Clean up
        await prisma.requirement.delete({ where: { id: req.id } })
        console.log('Cleaned up test requirement.')

    } catch (e: any) {
        console.error('❌ FAILED:', e.message)
        if (e.code === 'P2002') {
            console.error('Unique constraint violation detected!')
        }
        process.exit(1)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
