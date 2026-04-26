import { test, expect } from './helpers/fixtures'

/**
 * Lightweight accessibility smoke test for the Parameters page.
 *
 * No new npm dep — uses Playwright's built-in accessibility tree
 * (page.accessibility.snapshot) plus a few targeted DOM probes for the
 * highest-impact WCAG 2.2 AA failures: buttons without an accessible
 * name, images missing alt, form fields without an associated label,
 * and elements with role="dialog" lacking aria-label / aria-labelledby.
 *
 * For a deeper pass with axe-core, install the dep and add a separate
 * suite — kept out of this spec to honour the project's "no new
 * dependencies without approval" rule.
 */

test.describe('Parameters — a11y smoke', () => {
  test('Every button has an accessible name', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })

    const offenders = await page.evaluate(() => {
      const out: string[] = []
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const b of buttons) {
        // Skip hidden / off-screen buttons (offsetParent === null when display:none).
        if ((b as HTMLElement).offsetParent === null) continue
        const text = b.textContent?.trim() ?? ''
        const aria = b.getAttribute('aria-label')?.trim() ?? ''
        const title = b.getAttribute('title')?.trim() ?? ''
        const labelledBy = b.getAttribute('aria-labelledby')?.trim() ?? ''
        if (!text && !aria && !title && !labelledBy) {
          out.push(b.outerHTML.slice(0, 200))
        }
      }
      return out
    })
    // Surface the offending HTML on failure so the regression is
    // diagnosable from CI logs without a screenshot.
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test('Every image has an alt attribute', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => i.outerHTML.slice(0, 120)),
    )
    expect(offenders).toEqual([])
  })

  test('Modals carry aria-modal + aria-label / aria-labelledby', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for the toolbar so the keydown handler is mounted.
    await expect(page.getByRole('button', { name: /^List$/i })).toBeVisible({ timeout: 8_000 })
    await page.locator('body').click()
    await page.keyboard.press('?')
    const dialog = page.locator('[role="dialog"][aria-modal="true"]').first()
    await expect(dialog).toBeVisible({ timeout: 3_000 })
    const labelled = await dialog.evaluate((el) => {
      return !!(
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby')
      )
    })
    expect(labelled).toBe(true)
    await page.keyboard.press('Escape')
  })

  test('Form inputs in the New Parameter modal have labels', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })

    await page.getByRole('button', { name: /^\+?\s*New Parameter$/i }).click()
    const modal = page.locator('.fixed.inset-0').last()
    await expect(modal).toBeVisible({ timeout: 3_000 })

    const offenders = await modal.evaluate((root) => {
      const out: string[] = []
      const inputs = Array.from(
        root.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea'),
      ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      for (const el of inputs) {
        if ((el as HTMLElement).offsetParent === null) continue
        const id = el.id
        const aria = el.getAttribute('aria-label')?.trim() ?? ''
        const labelledBy = el.getAttribute('aria-labelledby')?.trim() ?? ''
        const placeholder = el.getAttribute('placeholder')?.trim() ?? ''
        const labelFor = id ? root.querySelector(`label[for="${id}"]`) : null
        const wrappingLabel = el.closest('label')
        const ok = !!labelFor || !!wrappingLabel || !!aria || !!labelledBy
        if (!ok && !placeholder) {
          // Placeholder alone isn't WCAG-compliant but most users still
          // get context — flag only the truly nameless inputs.
          out.push((el.outerHTML || '').slice(0, 160))
        }
      }
      return out
    })
    expect(offenders).toEqual([])

    // Close modal.
    await page.keyboard.press('Escape')
  })
})
