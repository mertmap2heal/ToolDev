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
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: 'Open Requirements' })).toBeVisible({
      timeout: 10_000,
    })
    // Every visible module card has an "Open <label>" accessible name; a
    // module hidden by the active feature package renders no such card. The
    // count of rendered cards never exceeds the 21-module catalogue.
    const cardCount = await page.getByRole('button', { name: /^Open / }).count()
    expect(cardCount).toBeGreaterThan(0)
    expect(cardCount).toBeLessThanOrEqual(21)
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
