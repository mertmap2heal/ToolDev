import { pathToFileURL } from 'url'
import { prisma } from '../lib/prisma'
import { PREDEFINED_ENGINEERING_ROLES } from '../lib/engineeringRoles'

/**
 * Seed the engineering-role (discipline-role) catalogue (R-7).
 * Run with: npm run seed:engineering-roles
 *
 * Idempotent: `EngineeringRole.name` is `@unique`, so each role is upserted
 * by name. `update: {}` is deliberate — re-running must NOT mutate
 * `description` or `isSystem` on rows an admin may have edited. Running this
 * on a DB that already holds the 16 legacy roles adds `CCB Member` only.
 *
 * Exported so tests can import and call it directly; also auto-run at module
 * scope so `tsx src/scripts/seed-engineering-roles.ts` still works.
 */
export async function seedEngineeringRoles(): Promise<{
  created: number
  existing: number
}> {
  let created = 0
  let existing = 0
  for (const name of PREDEFINED_ENGINEERING_ROLES) {
    const before = await prisma.engineeringRole.findUnique({ where: { name } })
    await prisma.engineeringRole.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    })
    if (before) {
      existing += 1
      console.log(`Engineering role already present: ${name}`)
    } else {
      created += 1
      console.log(`Engineering role created: ${name}`)
    }
  }
  console.log(
    `Engineering role catalogue seeded: ${created} created, ${existing} already present (${PREDEFINED_ENGINEERING_ROLES.length} total).`
  )
  return { created, existing }
}

async function main(): Promise<void> {
  try {
    await seedEngineeringRoles()
  } catch (error) {
    console.error('Error seeding engineering roles:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Auto-run only when invoked directly (`tsx src/scripts/seed-engineering-roles.ts`).
// When imported by a test, `main()` (and its prisma.$disconnect) must NOT run —
// the test owns the shared Prisma client lifecycle.
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}
