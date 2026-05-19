/**
 * Project Landing page (overview) — RF-3 (#487).
 *
 * The refreshed page renders a hero card (project identity + a metadata grid +
 * five discipline progress bars) and the 3-column V-model module navigator.
 */
import { test, expect } from './helpers/fixtures'

test.describe('Project Landing', () => {
  test('project landing page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(new RegExp(`projects/${projectId}`))
    // Page shows module category sections (divs, not h1/h2)
    await expect(page.locator('body')).toContainText(/requirements|tasks|verification/i, {
      timeout: 10_000,
    })
  })

  test('hero card renders the project name and metadata grid', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    // The hero card carries the project name in an <h2>.
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 10_000 })
    // The metadata grid surfaces these five labels.
    for (const label of ['Owner', 'Phase', 'Next gate', 'Last sync', 'Team']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 8_000,
      })
    }
  })

  test('the five discipline labels are visible in the hero', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 10_000 })
    for (const label of ['Overall', 'Requirements', 'Verification', 'Safety', 'Certification']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 8_000,
      })
    }
    // The discipline bars expose a progressbar role.
    await expect(page.getByRole('progressbar').first()).toBeVisible({ timeout: 8_000 })
  })

  test('a module card click navigates into that module', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    // Requirements is a Core-tier module — always rendered. Its card is a
    // button with an "Open Requirements" accessible label.
    const card = page.getByRole('button', { name: 'Open Requirements' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()
    await expect(page).toHaveURL(new RegExp(`projects/${projectId}/requirements`), {
      timeout: 10_000,
    })
  })

  test('a feature-disabled module is not rendered as a card', async ({ page, projectId }) => {
    // Drive the dev feature-package switch down to `core`. The provider reads
    // the `devPackage` localStorage key once, at mount (FeaturePackageContext
    // `getInitialPackage`), so the key must be set BEFORE a reload. `core`
    // includes `requirements` + `verification` but excludes `certification`
    // (minPackage `complete`) — see frontend/src/config/packages/core.json.
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    try {
      await page.evaluate(() => localStorage.setItem('devPackage', 'core'))
      await page.reload()
      await page.waitForLoadState('domcontentloaded')

      // A core module still renders its card.
      await expect(page.getByRole('button', { name: 'Open Requirements' })).toBeVisible({
        timeout: 10_000,
      })
      // A non-core module (Certification — `complete` tier) renders NO card
      // once the package is `core`. This is the real assertion the unstrict
      // `0 < n <= 21` count check could never make: it proves `isEnabled`
      // filtering actually removes a hidden module.
      await expect(page.getByRole('button', { name: 'Open Certification' })).toHaveCount(0)

      // Every visible card carries an "Open <label>" accessible name; the
      // rendered set is a strict subset of the 21-module catalogue.
      const cardCount = await page.getByRole('button', { name: /^Open / }).count()
      expect(cardCount).toBeGreaterThan(0)
      expect(cardCount).toBeLessThan(21)
    } finally {
      // Restore the dev-default `complete` package for any later test.
      await page.evaluate(() => localStorage.removeItem('devPackage'))
    }
  })

  test('loading and error copy is engineer-voice (no emoji)', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 10_000 })
    // No emoji on the landing page body — the design-system §5.4 voice rule.
    const bodyText = (await page.locator('body').innerText()) ?? ''
    expect(bodyText).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })
})
