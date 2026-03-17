/**
 * Reassign a project's owner to another user (by project name and new owner email).
 * Run: npx tsx src/scripts/reassign-project-owner.ts <projectName> <newOwnerEmail>
 * Example: npx tsx src/scripts/reassign-project-owner.ts MPAC mert.caferoglu
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projectName = process.argv[2]
  const newOwnerEmail = process.argv[3]

  if (!projectName || !newOwnerEmail) {
    console.error('Usage: npx tsx src/scripts/reassign-project-owner.ts <projectName> <newOwnerEmail>')
    console.error('Example: npx tsx src/scripts/reassign-project-owner.ts MPAC mert.caferoglu')
    process.exit(1)
  }

  const project = await prisma.project.findFirst({
    where: { name: projectName },
    include: { teamMembers: true },
  })

  if (!project) {
    console.error(`Project "${projectName}" not found.`)
    process.exit(1)
  }

  const newOwner = await prisma.user.findUnique({
    where: { email: newOwnerEmail },
  })

  if (!newOwner) {
    console.error(`User with email "${newOwnerEmail}" not found.`)
    process.exit(1)
  }

  const oldOwnerId = project.userId
  const newOwnerId = newOwner.id

  if (oldOwnerId === newOwnerId) {
    console.log(`Project "${projectName}" is already owned by ${newOwnerEmail}.`)
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: { userId: newOwnerId },
    }),
    prisma.projectMember.deleteMany({
      where: { projectId: project.id },
    }),
    prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: newOwnerId,
        role: 'owner',
      },
    }),
  ])

  console.log(`Project "${projectName}" owner reassigned to ${newOwnerEmail} (${newOwner.name}).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
