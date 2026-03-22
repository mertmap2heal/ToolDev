/**
 * Archive — Glossary & Abbreviations export modal
 */
import { test, expect } from './helpers/fixtures'

test.describe('Archive glossary export', () => {
  test('opens export modal with format and scope controls', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/archive`)
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('h1', { hasText: 'Archive' })).toBeVisible({ timeout: 15_000 })

    const glossarySection = page.locator('#glossary')
    await expect(glossarySection).toBeVisible()
    await glossarySection.getByRole('button', { name: 'Export' }).click()

    const dialog = page.getByRole('dialog', { name: /export glossary & abbreviations/i })
    await expect(dialog).toBeVisible()

    await expect(dialog.getByText(/full project list/i)).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /csv/i })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /excel/i })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /^pdf$/i })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /word/i })).toBeVisible()

    await expect(dialog.getByRole('radio', { name: /glossary only/i })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /abbreviations only/i })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /glossary and abbreviations/i })).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
  })
})
