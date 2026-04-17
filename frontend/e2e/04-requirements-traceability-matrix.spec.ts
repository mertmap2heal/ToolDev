/**
 * Requirements page — Traceability matrix modal
 *
 * Covers:
 *  1) Opening the matrix from the toolbar and basic shell (title, column target selector, table / empty state).
 *  2) Baseline view disables the Traceability control (read-only snapshot; no matrix edits).
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { ensurePbsChildComponent, openTraceabilityMatrixFromToolbar, readAuthToken } from './helpers/requirementsUi'
import { E2E_API_V1 } from './helpers/api'

function matrixModalRoot(page: Page): Locator {
  return page
    .getByRole('heading', { name: 'Traceability Matrix' })
    .locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
}

/** Match a PBS / target column header by substring (uses `title` or cell text). */
async function matrixColumnIndexForHeader(modalRoot: Locator, match: string): Promise<number> {
  const headers = modalRoot.locator('thead tr').first().locator('th')
  const count = await headers.count()
  for (let i = 0; i < count; i++) {
    const h = headers.nth(i)
    const title = await h.getAttribute('title')
    const text = (await h.innerText()).trim()
    if (title?.includes(match) || text.includes(match)) return i
  }
  throw new Error(`No column header matching "${match}"`)
}

test.describe('Requirements / Traceability matrix', () => {
  test('opens modal: title, target selector, and matrix area', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    await openTraceabilityMatrixFromToolbar(page)
    const modalRoot = page
      .getByRole('heading', { name: 'Traceability Matrix' })
      .locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
    const targetSelect = modalRoot.locator('select').first()
    await expect(targetSelect).toBeVisible()
    await expect(targetSelect).toHaveValue('pbs_component')

    await expect(modalRoot.getByText(/bidirectional trace reviews/i)).toBeVisible()

    // Either a data table or the empty-state message for this target type
    const emptyOrTable = page.getByRole('table').or(page.getByText(/No requirements found|No .* found\. Add items to build the matrix/i))
    await expect(emptyOrTable.first()).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^Close$/ }).last().click()
    await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
  })

  test('baseline view: Traceability button is disabled', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await readAuthToken(page)

    const reqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Matrix Baseline ${Date.now()}`,
        description: 'Seeded for traceability matrix baseline guard',
      },
    })
    expect(reqResp.ok(), await reqResp.text()).toBeTruthy()
    const reqBody = await reqResp.json()
    const req = reqBody?.data ?? reqBody
    const requirementId: string = req?.id
    expect(requirementId).toBeTruthy()

    const baselineResp = await page.request.post(`${E2E_API_V1}/baselines/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `E2E Baseline Matrix ${Date.now()}`,
        description: 'Seeded for traceability matrix baseline guard',
        requirementIds: [requirementId],
      },
    })
    expect(baselineResp.ok(), await baselineResp.text()).toBeTruthy()
    const baselineBody = await baselineResp.json()
    const baseline = baselineBody?.data ?? baselineBody
    const baselineId: string = baseline?.id
    expect(baselineId).toBeTruthy()

    await page.goto(`/projects/${projectId}/requirements?baselineId=${baselineId}`)
    await page.waitForLoadState('domcontentloaded')

    const traceBtn = page.getByRole('button', { name: /^Traceability$/ })
    await expect(traceBtn).toBeEnabled()
    await traceBtn.click()
    const matrixItem = page.getByRole('button', { name: /traceability matrix/i })
    await expect(matrixItem).toBeDisabled()
    await expect(matrixItem).toHaveAttribute('title', /unavailable in baseline view/i)
  })

  test('matrix: switching linkage target to Functions loads without errors', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    await openTraceabilityMatrixFromToolbar(page)
    const modalRoot = page
      .getByRole('heading', { name: 'Traceability Matrix' })
      .locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')

    const linkageSelect = modalRoot.locator('select').filter({ has: page.locator('option[value="pbs_component"]') })
    await expect(linkageSelect).toBeVisible()
    await linkageSelect.selectOption('function')

    const emptyOrTable = page
      .getByRole('table')
      .or(page.getByText(/No requirements found\. Create requirements to build the matrix\./))
      .or(page.getByText(/No Functions found\. Add items to build the matrix\./))
    await expect(emptyOrTable.first()).toBeVisible({ timeout: 30_000 })

    await expect(modalRoot.getByText(/Showing \d+ of \d+ requirements × \d+/)).toBeVisible()

    expect(errors, errors.join('; ')).toEqual([])

    await page.getByRole('button', { name: /^Close$/ }).last().click()
    await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
  })

  test('matrix: row filters and Suspect Only keep footer consistent', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    await openTraceabilityMatrixFromToolbar(page)
    const modalRoot = page
      .getByRole('heading', { name: 'Traceability Matrix' })
      .locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')

    const filterSelect = modalRoot.locator('select').filter({ has: page.locator('option[value="all"]') })
    await expect(filterSelect).toBeVisible()
    await filterSelect.selectOption('linked')
    await expect(modalRoot.getByText(/Showing \d+ of \d+ requirements × \d+/)).toBeVisible()

    await filterSelect.selectOption('unlinked')
    await expect(modalRoot.getByText(/Showing \d+ of \d+ requirements × \d+/)).toBeVisible()

    await filterSelect.selectOption('all')
    const suspect = modalRoot.getByRole('checkbox', { name: /suspect only/i })
    await suspect.check()
    await expect(suspect).toBeChecked()
    await suspect.uncheck()
    await expect(suspect).not.toBeChecked()

    expect(errors, errors.join('; ')).toEqual([])

    await page.getByRole('button', { name: /^Close$/ }).last().click()
    await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
  })

  test('matrix: Excel export triggers download', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    await openTraceabilityMatrixFromToolbar(page)
    const modalRoot = page
      .getByRole('heading', { name: 'Traceability Matrix' })
      .locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')

    const exportSelect = modalRoot.locator('select').filter({ has: page.locator('option[value="excel"]') })
    await expect(exportSelect).toBeVisible()
    await exportSelect.selectOption('excel')

    const downloadPromise = page.waitForEvent('download')
    await modalRoot.getByRole('button', { name: /^Export$/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)

    await page.getByRole('button', { name: /^Close$/ }).last().click()
    await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
  })

  test.describe('Traceability matrix — detailed flows', () => {
    test.describe.configure({ timeout: 120_000 })

    test('matrix: CSV, PDF, and Word exports trigger downloads', async ({ page, projectId }) => {
      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)
      const exportSelect = modalRoot.locator('select').filter({ has: page.locator('option[value="excel"]') })
      await expect(exportSelect).toBeVisible()

      for (const fmt of ['csv', 'pdf', 'word'] as const) {
        await exportSelect.selectOption(fmt)
        const downloadPromise = page.waitForEvent('download')
        await modalRoot.getByRole('button', { name: /^Export$/i }).click()
        const download = await downloadPromise
        const ext = fmt === 'csv' ? /\.csv$/i : fmt === 'pdf' ? /\.pdf$/i : /\.docx$/i
        expect(download.suggestedFilename(), `format ${fmt}`).toMatch(ext)
        expect(download.suggestedFilename()).toMatch(/^traceability_matrix_pbs_component\./i)
      }

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })

    test('matrix: stats bar shows Total Links and coverage labels', async ({ page, projectId }) => {
      const token = await readAuthToken(page)
      const title = `E2E matrix stats ${Date.now()}`
      const reqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title,
          description: 'Seeded for traceability matrix stats bar',
        },
      })
      expect(reqResp.ok(), await reqResp.text()).toBeTruthy()

      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)

      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })
      await expect(modalRoot.getByText(/Total Links:/)).toBeVisible()
      await expect(modalRoot.getByText(/Suspect Links:/)).toBeVisible()
      await expect(modalRoot.getByText(/Source Coverage:/)).toBeVisible()
      await expect(modalRoot.getByText(/Target Coverage:/)).toBeVisible()

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })

    test('matrix: create PBS trace link from empty cell', async ({ page, projectId }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const seeded = await ensurePbsChildComponent(page, projectId)
      test.skip(seeded == null, 'Could not seed PBS child component via API')

      const token = await readAuthToken(page)
      const stamp = Date.now()
      const seedTitle = `E2E matrix link ${stamp}`
      const reqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: seedTitle,
          description: 'Seeded for matrix create-link (no componentId)',
        },
      })
      expect(reqResp.ok(), await reqResp.text()).toBeTruthy()

      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)
      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })

      await expect(modalRoot.locator('table')).toBeVisible({ timeout: 30_000 })
      const row = modalRoot.locator('table tbody tr').filter({ hasText: seedTitle }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })

      const colIdx = await matrixColumnIndexForHeader(modalRoot, seeded.name)
      const dataCell = row.locator('td').nth(colIdx)
      await expect(dataCell.locator('svg').first()).toBeVisible({ timeout: 10_000 })

      await dataCell.click()
      const linkDialog = page.getByRole('heading', { name: 'Create Trace Link' }).locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
      await expect(linkDialog).toBeVisible({ timeout: 10_000 })
      await expect(linkDialog.getByText(/Source Requirement/i)).toBeVisible()

      await linkDialog.getByRole('button', { name: /^Create Link$/i }).click()
      await expect(page.getByRole('heading', { name: 'Create Trace Link' })).toHaveCount(0, { timeout: 30_000 })

      await expect(dataCell.locator('span.text-green-700, span.text-green-300').first()).toBeVisible({ timeout: 25_000 })

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })

    test('matrix: delete PBS trace link after creating via confirm', async ({ page, projectId }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const seeded = await ensurePbsChildComponent(page, projectId)
      test.skip(seeded == null, 'Could not seed PBS child component via API')

      const token = await readAuthToken(page)
      const stamp = Date.now()
      const seedTitle = `E2E matrix delete ${stamp}`
      const reqResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: seedTitle,
          description: 'Seeded for matrix delete-link (no componentId)',
        },
      })
      expect(reqResp.ok(), await reqResp.text()).toBeTruthy()

      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)
      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })

      await expect(modalRoot.locator('table')).toBeVisible({ timeout: 30_000 })
      const row = modalRoot.locator('table tbody tr').filter({ hasText: seedTitle }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })

      const colIdx = await matrixColumnIndexForHeader(modalRoot, seeded.name)
      const dataCell = row.locator('td').nth(colIdx)
      await expect(dataCell.locator('svg').first()).toBeVisible({ timeout: 10_000 })

      await dataCell.click()
      const linkDialog = page.getByRole('heading', { name: 'Create Trace Link' }).locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
      await expect(linkDialog).toBeVisible({ timeout: 10_000 })
      await linkDialog.getByRole('button', { name: /^Create Link$/i }).click()
      await expect(page.getByRole('heading', { name: 'Create Trace Link' })).toHaveCount(0, { timeout: 30_000 })
      await expect(dataCell.locator('span.text-green-700, span.text-green-300').first()).toBeVisible({ timeout: 25_000 })

      page.once('dialog', (d) => {
        expect(d.message()).toMatch(/delete.*trace link/i)
        d.accept()
      })
      await dataCell.click()
      await expect(dataCell.locator('span.text-green-700, span.text-green-300')).toHaveCount(0, { timeout: 25_000 })
      await expect(dataCell.locator('svg').first()).toBeVisible({ timeout: 15_000 })

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })

    test('matrix: Create Trace Link dialog cancel leaves cell unlinked', async ({ page, projectId }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const seeded = await ensurePbsChildComponent(page, projectId)
      test.skip(seeded == null, 'Could not seed PBS child component via API')

      const token = await readAuthToken(page)
      const stamp = Date.now()
      const seedTitle = `E2E matrix cancel ${stamp}`
      const reqResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: seedTitle,
          description: 'Seeded for matrix cancel dialog (no componentId)',
        },
      })
      expect(reqResp.ok(), await reqResp.text()).toBeTruthy()

      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)
      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })

      await expect(modalRoot.locator('table')).toBeVisible({ timeout: 30_000 })
      const row = modalRoot.locator('table tbody tr').filter({ hasText: seedTitle }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })

      const colIdx = await matrixColumnIndexForHeader(modalRoot, seeded.name)
      const dataCell = row.locator('td').nth(colIdx)
      await dataCell.click()

      const linkDialog = page.getByRole('heading', { name: 'Create Trace Link' }).locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
      await expect(linkDialog).toBeVisible({ timeout: 10_000 })
      await linkDialog.getByRole('button', { name: /^Cancel$/i }).click()
      await expect(page.getByRole('heading', { name: 'Create Trace Link' })).toHaveCount(0, { timeout: 10_000 })

      await expect(dataCell.locator('svg').first()).toBeVisible({ timeout: 5_000 })
      await expect(dataCell.locator('span.text-green-700, span.text-green-300')).toHaveCount(0)

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })

    test('matrix: requirement vs requirement shows Link Type and creates link', async ({ page, projectId }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const token = await readAuthToken(page)
      const stamp = Date.now()
      const titleA = `E2E rr source ${stamp}`

      const postReq = async (title: string) => {
        const resp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { title, description: 'req-req matrix e2e' },
        })
        expect(resp.ok(), await resp.text()).toBeTruthy()
        const body = await resp.json()
        const r = body?.data ?? body
        const id = r?.id as string
        return { id }
      }
      const reqA = await postReq(titleA)
      expect(reqA.id).toBeTruthy()

      const allResp = await page.request.get(`http://localhost:5000/api/v1/requirements/${projectId}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(allResp.ok(), await allResp.text()).toBeTruthy()
      const allBody = await allResp.json()
      const allReqs: Array<{ id: string }> = Array.isArray(allBody?.data) ? allBody.data : Array.isArray(allBody) ? allBody : []
      const first50 = allReqs.slice(0, 50)
      const colTarget = first50.find((r) => r.id !== reqA.id)
      test.skip(!colTarget, 'Need at least two requirements in the first 50 matrix columns')
      const colIdx = 1 + first50.indexOf(colTarget)

      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)
      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })

      const linkageSelect = modalRoot.locator('select').filter({ has: page.locator('option[value="pbs_component"]') })
      await linkageSelect.selectOption('requirement')

      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })
      await expect(modalRoot.locator('table')).toBeVisible({ timeout: 30_000 })

      const row = modalRoot.locator('table tbody tr').filter({ hasText: titleA }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })
      const dataCell = row.locator('td').nth(colIdx)
      await expect(dataCell.locator('svg').first()).toBeVisible({ timeout: 10_000 })

      await dataCell.click()
      const linkDialog = page.getByRole('heading', { name: 'Create Trace Link' }).locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
      await expect(linkDialog).toBeVisible({ timeout: 10_000 })
      await expect(linkDialog.getByText(/Link Type \(SysML Relationship\)/i)).toBeVisible()
      await expect(linkDialog.locator('select').filter({ has: page.locator('option[value="derives"]') })).toBeVisible()

      await linkDialog.getByRole('button', { name: /^Create Link$/i }).click()
      await expect(page.getByRole('heading', { name: 'Create Trace Link' })).toHaveCount(0, { timeout: 30_000 })
      await expect(dataCell.locator('span.text-green-700, span.text-green-300').first()).toBeVisible({ timeout: 25_000 })

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })

    test('matrix: dismiss delete confirm keeps linked PBS cell', async ({ page, projectId }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const seeded = await ensurePbsChildComponent(page, projectId)
      test.skip(seeded == null, 'Could not seed PBS child component via API')

      const token = await readAuthToken(page)
      const stamp = Date.now()
      const seedTitle = `E2E matrix dismiss ${stamp}`
      const reqResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: seedTitle,
          description: 'Seeded for matrix dismiss delete (no componentId)',
        },
      })
      expect(reqResp.ok(), await reqResp.text()).toBeTruthy()

      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')

      await openTraceabilityMatrixFromToolbar(page)
      const modalRoot = matrixModalRoot(page)
      await expect(modalRoot.getByText('Loading matrix data...')).toBeHidden({ timeout: 60_000 })

      await expect(modalRoot.locator('table')).toBeVisible({ timeout: 30_000 })
      const row = modalRoot.locator('table tbody tr').filter({ hasText: seedTitle }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })

      const colIdx = await matrixColumnIndexForHeader(modalRoot, seeded.name)
      const dataCell = row.locator('td').nth(colIdx)
      await dataCell.click()
      const linkDialog = page.getByRole('heading', { name: 'Create Trace Link' }).locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
      await expect(linkDialog).toBeVisible({ timeout: 10_000 })
      await linkDialog.getByRole('button', { name: /^Create Link$/i }).click()
      await expect(page.getByRole('heading', { name: 'Create Trace Link' })).toHaveCount(0, { timeout: 30_000 })
      await expect(dataCell.locator('span.text-green-700, span.text-green-300').first()).toBeVisible({ timeout: 25_000 })

      page.once('dialog', (d) => {
        expect(d.message()).toMatch(/delete.*trace link/i)
        d.dismiss()
      })
      await dataCell.click()
      await expect(dataCell.locator('span.text-green-700, span.text-green-300').first()).toBeVisible({ timeout: 10_000 })

      await page.getByRole('button', { name: /^Close$/ }).last().click()
      await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
    })
  })
})
