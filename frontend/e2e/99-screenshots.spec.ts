import { test } from './helpers/fixtures'
import path from 'path'

// One-shot visual capture of the Validation surfaces touched in cycles 60-106.
// Not a CI test — kept here only so the project's sanctioned login helper
// (loginViaUI / fixtures) handles auth instead of typing credentials into a
// raw browser session. Outputs live under frontend/screenshots/.
const OUT = path.resolve(process.cwd(), 'screenshots')

test('validation page + drawer screenshots', async ({ page, projectId }) => {
  test.setTimeout(60_000)

  // Validation page — list view. Clear persisted filters first so a stale
  // filter from a prior run does not show an empty table in the screenshot.
  await page.goto(`/projects/${projectId}/validation`)
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('validation:'))
      .forEach((k) => localStorage.removeItem(k))
  })
  await page.goto(`/projects/${projectId}/validation`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, '01-list.png'), fullPage: false })

  // Try open a row drawer if any items exist
  const rows = page.locator('table tbody tr').filter({ has: page.locator('td:nth-child(2)') })
  const count = await rows.count()
  if (count > 0) {
    // Click a non-title cell so the drawer opens (title cell now stops
    // propagation per the recent fix).
    await rows.first().locator('td:nth-child(7)').click().catch(async () => {
      await rows.first().locator('td:nth-child(6)').click().catch(() => {})
    })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, '02-drawer.png'), fullPage: false })

    // Scroll discussion section into view
    const discussion = page.getByText(/Discussion/i).first()
    if (await discussion.isVisible().catch(() => false)) {
      await discussion.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(OUT, '03-discussion.png'), fullPage: false })

      // Open the @-mention popover by typing in the composer textarea
      const composer = page
        .locator('textarea')
        .filter({ hasText: '' })
        .last()
      if (await composer.count()) {
        await composer.click()
        await composer.fill('Test mention @')
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(OUT, '04-mention-popover.png'), fullPage: false })
      }
    }
  }

  // Board view
  await page.goto(`/projects/${projectId}/validation`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(400)
  const boardBtn = page.getByRole('button', { name: /^Board$/ })
  if (await boardBtn.isVisible().catch(() => false)) {
    await boardBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, '06-board.png'), fullPage: false })
  }

  // DER view
  await page.goto(`/projects/${projectId}/validation/der`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, '07-der.png'), fullPage: false })

  // Settings page (criterion templates panel)
  await page.goto(`/projects/${projectId}/validation/settings`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, '08-settings.png'), fullPage: true })

  // Full list page (toolbar + table)
  await page.goto(`/projects/${projectId}/validation`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, '05-toolbar-view.png'), fullPage: true })
})
