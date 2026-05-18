import { pathToFileURL } from 'url'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

/**
 * Seed the dedicated Playwright e2e test account.
 * Run with: npm run seed:e2e-user
 *
 * WHY this exists
 * ---------------
 * The Playwright auth flow (`frontend/e2e/auth.setup.ts` ->
 * `frontend/e2e/helpers/auth.ts`) must log in before any spec runs. It needs
 * a user that reliably exists in the dev DB with a known password. The
 * personal / demo accounts seeded by `seed:users` (mert.caferoglu,
 * christian.mandle, admin) are NOT suitable test fixtures — their passwords
 * come from `SEED_PASSWORD_*` secrets and `christian.mandle@gmail.com` is a
 * real personal address. This script creates a clearly-disposable account
 * whose password is a fixed, non-secret test constant, so the e2e suite is
 * self-contained: a fresh checkout + `start.ps1` + `npx playwright test`
 * authenticates with nobody hand-seeding anything.
 *
 * THE CREDENTIAL CONTRACT
 * -----------------------
 * `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` below MUST stay byte-identical to
 * the fallback constants `E2E_DEFAULT_USERNAME` / `E2E_DEFAULT_PASSWORD` in
 * `frontend/e2e/helpers/auth.ts`. They cannot share an import — the e2e
 * helper lives in the `frontend/` package and cannot reach `backend/src`.
 * Change one, change the other.
 *
 * Idempotent: `User.email` is `@unique`, so the account is upserted by email.
 * Re-running re-applies the known password (self-healing if it ever desyncs)
 * and never touches any other row.
 *
 * NOT a secret: the password is a fixed test value committed on purpose so
 * the suite needs no env var. This account has no special role and is only
 * ever created in a dev/test DB. Never give it `SUPERIOR_ADMIN`.
 *
 * Exported so tests can import and call it directly; also auto-run at module
 * scope so `tsx src/scripts/seed-e2e-user.ts` still works.
 */
export const E2E_USER_EMAIL = 'e2e@example.com'
export const E2E_USER_PASSWORD = 'e2e-test-password-123'
const E2E_USER_NAME = 'E2E Test User'

export async function seedE2eUser(): Promise<{ created: boolean }> {
  const before = await prisma.user.findUnique({
    where: { email: E2E_USER_EMAIL },
    select: { id: true },
  })

  const hashedPassword = await bcrypt.hash(E2E_USER_PASSWORD, 10)

  await prisma.user.upsert({
    where: { email: E2E_USER_EMAIL },
    // Re-apply the known password every run so the account self-heals if its
    // hash is ever desynced from what the e2e helper logs in with. Never set
    // a role here — this is an ordinary user.
    update: { password: hashedPassword, name: E2E_USER_NAME },
    create: {
      email: E2E_USER_EMAIL,
      name: E2E_USER_NAME,
      password: hashedPassword,
      // Explicit: the e2e auth flow must not be blocked by the forced
      // "Change your password" modal.
      mustChangePasswordOnFirstLogin: false,
    },
  })

  const created = !before
  console.log(
    created
      ? `E2E test user created: ${E2E_USER_EMAIL}`
      : `E2E test user already present — password re-applied: ${E2E_USER_EMAIL}`
  )
  return { created }
}

async function main(): Promise<void> {
  try {
    await seedE2eUser()
  } catch (error) {
    console.error('Error seeding e2e user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Auto-run only when invoked directly (`tsx src/scripts/seed-e2e-user.ts`).
// When imported by a test, `main()` (and its prisma.$disconnect) must NOT run —
// the test owns the shared Prisma client lifecycle.
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}
