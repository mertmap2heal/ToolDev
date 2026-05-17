/**
 * Generate the committed OpenAPI 3.1 spec — NX-5 (#451).
 *
 * Run with: `npm run openapi:generate`
 *
 * Writes a deterministic `backend/openapi.json` from the `@openapi` JSDoc
 * annotations on the route files. The file is source-controlled so the spec
 * is a reviewable diff in every PR, and a husky pre-push freshness gate
 * (`npm run openapi:check`) fails any push whose route change did not
 * regenerate it.
 *
 * `--check` mode regenerates the spec into memory and compares it against
 * the committed file WITHOUT writing — exit 0 if identical, exit 1 (with a
 * diff hint) if drifted. This is the mode the husky gate invokes.
 *
 * Determinism notes:
 *   - swagger-jsdoc walks the `apis` globs; `fast-glob` (its matcher)
 *     returns results in a stable sorted order, so paths are stable.
 *   - `JSON.stringify(spec, null, 2)` with a trailing newline produces
 *     byte-stable output across runs.
 *   - The route globs are resolved to absolute `.ts` paths here so the
 *     output does not depend on the process CWD.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildOpenApiSpec } from '../openapi/openapi.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Absolute path of the committed spec file: `backend/openapi.json`. */
const SPEC_PATH = path.resolve(__dirname, '..', '..', 'openapi.json')

/** Absolute glob of the route-file `.ts` sources to scan. */
const ROUTE_GLOB = path
  .resolve(__dirname, '..', 'routes', '*.routes.ts')
  // swagger-jsdoc / fast-glob expect forward slashes even on Windows.
  .replace(/\\/g, '/')

/** Serialise the spec deterministically: 2-space indent + trailing newline. */
function serialise(spec: unknown): string {
  return JSON.stringify(spec, null, 2) + '\n'
}

function main(): void {
  const checkMode = process.argv.includes('--check')

  const spec = buildOpenApiSpec([ROUTE_GLOB])
  const generated = serialise(spec)

  const pathCount = Object.keys((spec as { paths?: object }).paths ?? {}).length

  if (checkMode) {
    if (!fs.existsSync(SPEC_PATH)) {
      console.error(
        '[openapi:check] FAIL — openapi.json does not exist. ' +
          'Run `npm run openapi:generate` and commit the result.',
      )
      process.exit(1)
    }
    const committed = fs.readFileSync(SPEC_PATH, 'utf8')
    if (committed === generated) {
      console.log(`[openapi:check] OK — openapi.json is up to date (${pathCount} paths).`)
      process.exit(0)
    }
    console.error(
      '[openapi:check] FAIL — openapi.json is stale.\n' +
        'A route-file `@openapi` annotation changed but the committed spec ' +
        'was not regenerated.\n' +
        'Fix: run `npm run openapi:generate` and commit `backend/openapi.json`.',
    )
    process.exit(1)
  }

  fs.writeFileSync(SPEC_PATH, generated, 'utf8')
  console.log(`[openapi:generate] wrote ${SPEC_PATH} (${pathCount} paths).`)
}

main()
