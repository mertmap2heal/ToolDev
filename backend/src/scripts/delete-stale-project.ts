
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROJECT_ID_TO_DELETE = 'e7951c73-6aa4-457f-8916-e0e2501c3a68'

async function main() {
    console.log(`Attempting to delete project: ${PROJECT_ID_TO_DELETE}`)

    const project = await prisma.project.findUnique({
        where: { id: PROJECT_ID_TO_DELETE }
    })

    if (!project) {
        console.log('Project not found.')
        return
    }

    console.log(`Found project: ${project.name}`)

    // Prisma cascade delete should handle related records if configured correctly in schema.
    // Based on schema.prisma: 
    // project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
    // Most relations seem to have onDelete: Cascade.

    const deleted = await prisma.project.delete({
        where: { id: PROJECT_ID_TO_DELETE }
    })

    console.log(`Successfully deleted project: ${deleted.name} (${deleted.id})`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
