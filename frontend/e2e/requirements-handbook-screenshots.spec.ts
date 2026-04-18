/**
 * Captures PNGs for guidelines/requirements-page.md.
 * Requires: app on :3000, API on :5000, and successful auth setup (e2e auth.setup.ts).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from './helpers/fixtures'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', '..', 'guidelines', 'assets', 'requirements')

test.describe('Requirements handbook screenshots', () => {
  test('writes guideline assets to guidelines/assets/requirements', async ({ page, projectId }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true })

    await page.goto(`/projects/${projectId}/requirements/browse?panel=1&panelTab=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 2, name: 'Requirements', exact: true })).toBeVisible({
      timeout: 30_000,
    })

    await page.screenshot({ path: path.join(OUT_DIR, 'overview.png'), fullPage: true })

    const vp = page.viewportSize()
    const clipH = Math.min(vp?.height ?? 900, 900)
    await page.screenshot({
      path: path.join(OUT_DIR, 'left-panel.png'),
      clip: { x: 0, y: 0, width: 380, height: clipH },
    })

    await page.getByTitle('Sort By').click()
    await page.screenshot({ path: path.join(OUT_DIR, 'filters-and-search.png'), fullPage: false })
    await page.keyboard.press('Escape')

    await page.getByTitle('View Options').click()
    await page.screenshot({ path: path.join(OUT_DIR, 'view-menu.png'), fullPage: false })
    await page.keyboard.press('Escape')

    await page.getByTitle('Manage').click()
    await page.screenshot({ path: path.join(OUT_DIR, 'manage-menu.png'), fullPage: false })
    await page.keyboard.press('Escape')

    await page.getByTitle('Traceability Options').click()
    await page.screenshot({ path: path.join(OUT_DIR, 'traceability-menu.png'), fullPage: false })
    await page.keyboard.press('Escape')
  })
})
