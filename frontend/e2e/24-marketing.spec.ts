/**
 * Marketing — the canonical landing page at `/`.
 *
 * NX-6 (issue #454): the PreviewLanding per-section rebuild — inline-style
 * migration, dead-anchor cleanup, honest compliance copy, FAQ accordion.
 *
 * The landing only renders for an UNAUTHENTICATED visitor (LandingOrApp
 * gates on the session token), so every test below opens its own context
 * with `storageState: undefined` — the pattern from 23-legal-pages.spec.ts.
 */
import { test, expect } from './helpers/fixtures'
import type { Page } from '@playwright/test'

/** id="..." targets that exist as in-page scroll anchors on the landing. */
const IN_PAGE_IDS = ['top', 'product', 'start']

test.describe('Marketing — landing page', () => {
  test('landing page loads at / with the key sections visible', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL(/\/$/)

    // Hero — the three-second pitch heading.
    await expect(
      page.getByRole('heading', { name: /certify in months/i, level: 1 }),
    ).toBeVisible({ timeout: 10_000 })

    // The narrative sections.
    await expect(
      page.getByRole('heading', { name: /built around the objective/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /ai proposes\. a human disposes/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /integrate, don.t replace/i }),
    ).toBeVisible()

    // FAQ section.
    await expect(
      page.getByRole('heading', { name: /the questions that decide it/i }),
    ).toBeVisible()

    await ctx.close()
  })

  test('navbar Start free CTA navigates to /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The nav bar Start free CTA (first "Start free" on the page).
    await page.getByRole('link', { name: /^start free$/i }).first().click()
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 })

    await ctx.close()
  })

  test('hero Start free CTA navigates to /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The hero CTA — scoped to the hero region so it is not the nav CTA.
    const heroCta = page
      .locator('.pl-hero')
      .getByRole('link', { name: /^start free$/i })
    await expect(heroCta).toBeVisible({ timeout: 5_000 })
    await heroCta.click()
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 })

    await ctx.close()
  })

  test('bottom CTA-block Start free navigates to /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const ctaBlock = page
      .locator('.pl-cta-block')
      .getByRole('link', { name: /^start free$/i })
    await expect(ctaBlock).toBeVisible({ timeout: 5_000 })
    await ctaBlock.click()
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 })

    await ctx.close()
  })

  test('FAQ accordion opens and closes', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The first FAQ panel is open by default.
    const firstQuestion = page.getByRole('button', {
      name: /which standards do you support/i,
    })
    await expect(firstQuestion).toBeVisible({ timeout: 5_000 })
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')

    // A collapsed question — open it.
    const closedQuestion = page.getByRole('button', {
      name: /is the tool itself certified/i,
    })
    await expect(closedQuestion).toHaveAttribute('aria-expanded', 'false')
    await closedQuestion.click()
    await expect(closedQuestion).toHaveAttribute('aria-expanded', 'true')

    // Its answer panel is now visible.
    await expect(
      page.getByText(/no tool is a certification/i),
    ).toBeVisible({ timeout: 3_000 })

    // Clicking it again collapses it.
    await closedQuestion.click()
    await expect(closedQuestion).toHaveAttribute('aria-expanded', 'false')

    await ctx.close()
  })

  test('TrustStrip carries honest pre-launch qualifiers, not bare claims', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Honest qualifier — readiness in progress, not a bare "SOC 2 Type II" claim.
    await expect(
      page.getByText(/SOC 2 Type II - readiness in progress/i),
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByText(/ISO\/IEC 42001 - alignment in progress/i),
    ).toBeVisible()

    // The bare, false SOC 2 claim that the honest pass replaced must be gone:
    // the TrustStrip must never carry "SOC 2 Type II" without a qualifier.
    await expect(page.getByText(/^SOC 2 Type II$/i)).toHaveCount(0)
    // No copy that *claims* the tool is certified (a false pre-launch claim).
    // Note: the FAQ legitimately *asks* "Is the tool itself certified?" — that
    // question is honest copy and is asserted present elsewhere; here we only
    // forbid a positive claim such as "DO-178C certified" / "is certified".
    await expect(page.getByText(/\bis certified\b/i)).toHaveCount(0)
    await expect(page.getByText(/DO-178C certified/i)).toHaveCount(0)

    await ctx.close()
  })

  test('no dead # anchor remains — every link resolves to a real target', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await assertNoDeadAnchors(page)

    await ctx.close()
  })
})

/**
 * Every <a> on the landing must resolve to one of:
 *  - a real router path (starts with `/`)
 *  - an in-page scroll anchor whose `#id` target exists on the page
 *  - a mailto: link
 * A bare `#` or a `#fragment` with no matching element is a dead affordance.
 */
async function assertNoDeadAnchors(page: Page) {
  const hrefs = await page.locator('.preview-landing a[href]').evaluateAll(
    (els) => els.map((el) => (el as HTMLAnchorElement).getAttribute('href') || ''),
  )
  expect(hrefs.length).toBeGreaterThan(0)

  for (const href of hrefs) {
    if (href.startsWith('mailto:')) {
      // mailto must carry an address.
      expect(href.length, `mailto missing address: ${href}`).toBeGreaterThan('mailto:'.length)
      continue
    }
    if (href.startsWith('/')) {
      // A real router path.
      continue
    }
    if (href.startsWith('#')) {
      // An in-page scroll anchor — its target id must exist.
      const id = href.slice(1)
      expect(id.length, `bare "#" anchor with no target`).toBeGreaterThan(0)
      expect(
        IN_PAGE_IDS,
        `in-page anchor "${href}" points at an id that does not exist on the landing`,
      ).toContain(id)
      // Belt and braces — confirm the element is actually in the DOM.
      await expect(page.locator(`#${id}`)).toHaveCount(1)
      continue
    }
    // Anything else (a real external https URL would be fine, but the
    // landing has none today) — fail loudly so a regression is caught.
    throw new Error(`unexpected anchor href on landing: "${href}"`)
  }
}
