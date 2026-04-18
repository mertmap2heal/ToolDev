/**
 * Delete a specific project by id. Cascades to every child record via
 * Prisma onDelete: Cascade relations (requirements, functions, audit
 * logs, etc.), so this is catastrophic if run against the wrong DB.
 *
 * #300: removed the baked-in UUID. Requires three explicit opt-ins:
 *   1. ALLOW_DESTRUCTIVE_SCRIPTS=true in the environment.
 *   2. NODE_ENV=development (refuses otherwise).
 *   3. CLI flag --yes-delete-forever AND the projectId as a positional arg.
 *
 * Before the final delete the script prints the resolved project name
 * and waits 5 seconds so a mis-run can still be Ctrl-C'd.
 */
import { prisma } from '../lib/prisma'

const CONFIRM_FLAG = '--yes-delete-forever'

async function main() {
  const args = process.argv.slice(2)
  const projectId = args.find((a) => !a.startsWith('--'))
  const flags = new Set(args.filter((a) => a.startsWith('--')))

  if (!projectId) {
    console.error(
      `Usage: npx tsx src/scripts/delete-stale-project.ts <projectId> ${CONFIRM_FLAG}`,
    )
    process.exit(1)
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Refusing to run: delete-stale-project is forbidden in production (set NODE_ENV=development).',
    )
    process.exit(1)
  }

  if (process.env.ALLOW_DESTRUCTIVE_SCRIPTS !== 'true') {
    console.error(
      'Refusing to run: ALLOW_DESTRUCTIVE_SCRIPTS=true must be set in the environment.',
    )
    process.exit(1)
  }

  if (!flags.has(CONFIRM_FLAG)) {
    console.error(
      `Refusing to run: cascading project delete needs explicit ${CONFIRM_FLAG}.`,
    )
    process.exit(1)
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    console.log(`Project ${projectId} not found.`)
    return
  }

  console.log(`About to delete project: ${project.name} (${project.id}).`)
  console.log('All related records cascade. Press Ctrl-C within 5 seconds to abort.')
  await new Promise((resolve) => setTimeout(resolve, 5000))

  const deleted = await prisma.project.delete({
    where: { id: project.id },
  })

  console.log(`Deleted project: ${deleted.name} (${deleted.id}).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
