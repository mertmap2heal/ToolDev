import { test as base, expect } from '@playwright/test'
import { AUTH_FILE, getOrCreateProjectId } from './auth'
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
  storageState: async ({}, use) => {
    if (fs.existsSync(AUTH_FILE)) {
      await use(AUTH_FILE)
    } else {
      await use(undefined as unknown)
    }
  },

  projectId: async ({ page }, use) => {
    const id = await getOrCreateProjectId(page)
    await use(id)
  },
})

export { expect }
