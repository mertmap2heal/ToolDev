import { test as base, expect } from '@playwright/test'
import { AUTH_FILE, getFirstProjectId } from './auth'
import fs from 'fs'

type Fixtures = {
  projectId: string
}

/**
 * Extended test fixture that:
 *  - Ensures the user is logged in (reuses saved storage state where possible)
 *  - Provides a `projectId` fixture with the first available project
 */
export const test = base.extend<Fixtures>({
  // Override storageState to use saved session if available
  storageState: async (_fixtures, use) => {
    if (fs.existsSync(AUTH_FILE)) {
      await use(AUTH_FILE)
    } else {
      await use(undefined as unknown)
    }
  },

  projectId: async ({ page }, use) => {
    const id = await getFirstProjectId(page)
    if (!id) throw new Error('No project found — seed demo data first (npm run seed:demo)')
    await use(id)
  },
})

export { expect }
