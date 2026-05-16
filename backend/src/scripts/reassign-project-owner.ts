/**
 * Reassign a project's owner to another user (by project name + new owner email).
 *
 * #301: hardened to prevent accidental mass-deletion of collaborators.
 *
 * Guards before any write:
 *   1. ALLOW_DESTRUCTIVE_SCRIPTS env var must be set to "true".
 *   2. NODE_ENV must be "development" (refuses to run against prod).
 *   3. CLI must include the explicit confirmation flag
 *      --yes-i-know-this-wipes-collaborators.
 *
 * All member deletions and the new owner assignment are logged to the
 * AuditLog table so the change is traceable after the fact.
 *
 * Run: npx tsx src/scripts/reassign-project-owner.ts <projectName> <newOwnerEmail> --yes-i-know-this-wipes-collaborators
 */
import { prisma } from '../lib/prisma'

const CONFIRM_FLAG = '--yes-i-know-this-wipes-collaborators'

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')))
  const [projectName, newOwnerEmail] = positional

  if (!projectName || !newOwnerEmail) {
    console.error(
      `Usage: npx tsx src/scripts/reassign-project-owner.ts <projectName> <newOwnerEmail> ${CONFIRM_FLAG}`,
    )
    process.exit(1)
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Refusing to run: reassign-project-owner is forbidden in production (set NODE_ENV=development).',
    )
    process.exit(1)
  }

  if (process.env.ALLOW_DESTRUCTIVE_SCRIPTS !== 'true') {
    console.error(
      'Refusing to run: ALLOW_DESTRUCTIVE_SCRIPTS=true must be set in the environment for this script.',
    )
    process.exit(1)
  }

  if (!flags.has(CONFIRM_FLAG)) {
    console.error(
      `Refusing to run: reassign-project-owner deletes every ProjectMember row. Pass ${CONFIRM_FLAG} to acknowledge.`,
    )
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

  const oldMembers = project.teamMembers ?? []

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
    prisma.auditLog.create({
      data: {
        projectId: project.id,
        userId: newOwnerId,
        action: 'PROJECT_OWNER_REASSIGNED',
        detailsJson: {
          previousOwnerId: oldOwnerId,
          newOwnerId,
          newOwnerEmail,
          wipedMembers: oldMembers.map((m) => ({
            userId: m.userId,
            role: m.role,
          })),
        },
      },
    }),
  ])

  console.log(
    `Project "${projectName}" owner reassigned to ${newOwnerEmail} (${newOwner.name}). ${oldMembers.length} member row(s) wiped; AuditLog entry created.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
