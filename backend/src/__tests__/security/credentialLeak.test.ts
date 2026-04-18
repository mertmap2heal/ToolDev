/**
 * Guard test for issue #173.
 *
 * Fails if any of the previously leaked credential literals reappear in
 * tracked source paths that are particularly prone to accidental commits
 * of test credentials:
 *   - frontend/e2e/helpers/
 *   - frontend/e2e/*.spec.ts
 *   - .github/workflows/
 *
 * If this test fails, the credential must be removed and the value moved to
 * an environment variable or GitHub Actions secret. See issue #173.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../../')

// String fragments that, if seen inline, indicate a credential leak
// regressed into one of the monitored source areas.
const FORBIDDEN_LITERALS = [
  'mandle1998',
  'Mmcf_6378',
]

// Directories to scan - limited to high-risk e2e helper and CI areas so
// the guard is fast and does not overreach into dev scripts (seeding,
// debug scripts) which are tracked in follow-up work.
const SCAN_TARGETS: string[] = [
  'frontend/e2e/helpers',
  '.github/workflows',
]

// Individual files to scan (not directories).
const SCAN_FILES: string[] = [
  'start.ps1',
]

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

describe('credential leak guard (issue #173)', () => {
  it('no forbidden credential literals in e2e helpers, CI workflows, or start script (#145, #173)', () => {
    const offenders: Array<{ file: string; literal: string }> = []
    const scanFile = (absPath: string) => {
      if (!fs.existsSync(absPath)) return
      const content = fs.readFileSync(absPath, 'utf8')
      for (const literal of FORBIDDEN_LITERALS) {
        if (content.includes(literal)) {
          offenders.push({ file: path.relative(REPO_ROOT, absPath), literal })
        }
      }
    }
    for (const target of SCAN_TARGETS) {
      const files = walk(path.join(REPO_ROOT, target))
      for (const file of files) {
        scanFile(file)
      }
    }
    for (const file of SCAN_FILES) {
      scanFile(path.join(REPO_ROOT, file))
    }
    expect(
      offenders,
      `Credential leak regression. Move these values to env vars / secrets: ${JSON.stringify(offenders, null, 2)}`,
    ).toEqual([])
  })

  it('e2e auth helper does not hardcode a password fallback string', () => {
    const authTs = path.join(REPO_ROOT, 'frontend/e2e/helpers/auth.ts')
    const content = fs.readFileSync(authTs, 'utf8')
    // The fix at #173 replaces the previous `?? 'password_string'` fallback
    // with a resolveCreds() helper that throws on missing env. Detect any
    // regression where a literal fallback string is reintroduced on the
    // password line.
    const passwordLine = content
      .split('\n')
      .find(line => /\bE2E_PASSWORD\b/.test(line))
    expect(passwordLine).toBeDefined()
    // A literal fallback would look like `?? '...'` on the same line.
    expect(
      passwordLine,
      'Literal password fallback detected on the E2E_PASSWORD line - remove and rely on env vars.',
    ).not.toMatch(/\?\?\s*['"`][^'"`]+['"`]/)
  })
})
