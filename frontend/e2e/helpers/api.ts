/**
 * Base URL for direct backend API calls in Playwright tests.
 *
 * page.request bypasses the Vite dev-server proxy, so tests must address the
 * backend directly.  Override with E2E_API_BASE_URL env var when running
 * against a non-default port or a remote environment.
 */
export const E2E_API_V1 = (process.env.E2E_API_BASE_URL ?? 'http://localhost:5000') + '/api/v1'
